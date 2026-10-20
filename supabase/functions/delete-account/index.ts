// supabase/functions/delete-account/index.ts
//
// Exclui DEFINITIVAMENTE a conta de quem chamou: apaga os dados do usuário
// (plantões, regras de repetição, locais de trabalho, perfil, foto e log de
// envios) e, por último, o próprio usuário no Auth. O id do usuário vem
// SEMPRE do token de sessão enviado pelo app (supabase.functions.invoke) —
// nunca do corpo da requisição —, então ninguém consegue apagar a conta de
// outra pessoa.
//
// Variáveis de ambiente: SUPABASE_URL, SUPABASE_ANON_KEY e
// SUPABASE_SERVICE_ROLE_KEY já existem automaticamente em toda Edge Function.
//
// Deploy (do seu computador, na raiz do projeto):
//   supabase functions deploy delete-account
import { createClient } from 'npm:@supabase/supabase-js@2';

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

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return jsonResponse({ error: 'Não autenticado.' }, 401);
  }

  try {
    // cliente "em nome do usuário": só resolve quem está de fato logado
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return jsonResponse({ error: 'Não foi possível identificar o usuário.' }, 401);
    }

    // service role: ignora RLS, necessário pra apagar o usuário do Auth
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const userId = user.id;

    // Ordem importa por causa das chaves estrangeiras: plantões →
    // regras de repetição → locais de trabalho → perfil.
    const steps: Array<{ table: string; column: string; required: boolean }> = [
      { table: 'shifts', column: 'user_id', required: true },
      { table: 'recurrence_rules', column: 'user_id', required: true },
      { table: 'hospitals', column: 'user_id', required: true },
      { table: 'report_email_log', column: 'user_id', required: false },
      { table: 'profiles', column: 'id', required: true },
    ];

    for (const step of steps) {
      const { error } = await admin.from(step.table).delete().eq(step.column, userId);
      if (error) {
        console.error(`Falha ao apagar ${step.table}:`, error.message);
        if (step.required) {
          return jsonResponse({ error: 'Não foi possível excluir os dados da conta.' }, 500);
        }
      }
    }

    // foto de perfil (best-effort — se não existir, tudo bem)
    await admin.storage
      .from('avatars')
      .remove([`${userId}/avatar.jpg`])
      .catch(() => {});

    const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
    if (deleteError) {
      console.error('Falha ao apagar o usuário do Auth:', deleteError.message);
      return jsonResponse({ error: 'Não foi possível excluir a conta.' }, 500);
    }

    return jsonResponse({ ok: true }, 200);
  } catch (error) {
    console.error('Erro inesperado em delete-account:', error);
    return jsonResponse({ error: 'Erro inesperado ao excluir a conta.' }, 500);
  }
});
