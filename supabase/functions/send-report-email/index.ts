// supabase/functions/send-report-email/index.ts
//
// Envia o relatório (CSV ou PDF) por e-mail automaticamente, pelo backend —
// substitui o fluxo antigo que abria o app de e-mail do celular
// (expo-mail-composer). O destinatário é SEMPRE o e-mail da própria conta
// autenticada, lido a partir do token de sessão que o app manda em toda
// chamada via supabase.functions.invoke — nunca um endereço vindo do corpo
// da requisição. Isso evita que a function vire um "relay" de e-mail aberto.
//
// Variáveis de ambiente:
//   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY — já existem
//     automaticamente em toda Edge Function, não precisa configurar.
//   RESEND_API_KEY — chave de API gerada em resend.com (Settings → API Keys).
//   REPORT_FROM_EMAIL — remetente verificado na Resend, ex.:
//     "Plantão ON <relatorios@notificacoes.seudominio.com.br>"
//     (ver instruções de verificação de domínio na própria Resend).
//
// Configurar os secrets (uma vez só, do seu computador):
//   supabase secrets set RESEND_API_KEY=sua_chave_aqui
//   supabase secrets set REPORT_FROM_EMAIL="Plantão ON <relatorios@notificacoes.seudominio.com.br>"
//
// Deploy:
//   supabase functions deploy send-report-email
import { createClient } from 'npm:@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
// Enquanto o domínio próprio não estiver verificado na Resend, esse
// remetente de teste da própria Resend funciona (só ele pode ser usado sem
// domínio verificado) — troque pela variável REPORT_FROM_EMAIL assim que o
// domínio estiver pronto.
const FROM_EMAIL = Deno.env.get('REPORT_FROM_EMAIL') ?? 'Plantão ON <onboarding@resend.dev>';
// Freio de abuso, não limite de uso normal — ninguém gerando relatórios
// manualmente chega perto disso. Existe só pra impedir alguém de
// automatizar chamadas nessa function e estourar a cota/custo na Resend.
const MAX_EMAILS_PER_HOUR = 10;

interface RequestBody {
  subject: string;
  html: string;
  fileName: string;
  contentType: string;
  base64Content: string;
}

function jsonResponse(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Método não permitido.' }, 405);
  }

  if (!RESEND_API_KEY) {
    console.error('RESEND_API_KEY não configurada.');
    return jsonResponse({ error: 'Envio de e-mail não configurado no servidor.' }, 500);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return jsonResponse({ error: 'Não autenticado.' }, 401);
  }

  try {
    // Cliente "em nome do usuário" — usa o token que ele já mandou, não a
    // service role — assim auth.getUser() só resolve pra quem realmente
    // está logado nessa sessão.
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user?.email) {
      return jsonResponse({ error: 'Não foi possível identificar o usuário.' }, 401);
    }

    // Client separado com a service role, só pra ler/gravar o log de rate
    // limit — ignora RLS de propósito (a tabela não tem nenhuma policy, só a
    // service role acessa) e nunca é usado pra nada que o app ou o usuário
    // devam ver diretamente.
    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count, error: countError } = await supabaseAdmin
      .from('report_email_log')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('sent_at', oneHourAgo);

    // se a contagem falhar por algum motivo, deixa passar — rate limit é uma
    // proteção extra, não pode virar motivo de travar um envio legítimo
    if (!countError && (count ?? 0) >= MAX_EMAILS_PER_HOUR) {
      return jsonResponse({ error: 'Muitos envios em pouco tempo. Tente novamente mais tarde.' }, 429);
    }

    const body: RequestBody = await req.json();
    if (!body?.base64Content || !body?.fileName || !body?.subject) {
      return jsonResponse({ error: 'Requisição incompleta.' }, 400);
    }

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [user.email],
        subject: body.subject,
        html: body.html,
        attachments: [
          {
            filename: body.fileName,
            content: body.base64Content,
          },
        ],
      }),
    });

    if (!resendResponse.ok) {
      const detail = await resendResponse.text();
      console.error('Resend recusou o envio:', resendResponse.status, detail);
      return jsonResponse({ error: 'Falha ao enviar o e-mail.' }, 502);
    }

    // registra o envio pro rate limit — best-effort: se essa gravação falhar,
    // não desfaz nem bloqueia o e-mail que já foi enviado com sucesso
    await supabaseAdmin
      .from('report_email_log')
      .insert({ user_id: user.id })
      .then(
        () => {},
        () => {}
      );

    return jsonResponse({ ok: true, sentTo: user.email }, 200);
  } catch (error) {
    console.error('Erro inesperado em send-report-email:', error);
    return jsonResponse({ error: 'Erro inesperado ao enviar o e-mail.' }, 500);
  }
});