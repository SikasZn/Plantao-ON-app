<div align="center">

<img src="docs/banner.jpg" alt="Plantão ON — Seus plantões e ganhos em um só lugar" width="100%">

# Plantão ON

**Escala de plantões, ganhos e relatórios em um só aplicativo.**

[![App Store](https://img.shields.io/badge/App%20Store-baixar-0f172a?style=for-the-badge&logo=apple&logoColor=white)](https://apps.apple.com/br/app/plant%C3%A3o-on/id6827799854)
[![Google Play](https://img.shields.io/badge/Google%20Play-baixar-0f172a?style=for-the-badge&logo=googleplay&logoColor=white)](https://play.google.com/store/apps/details?id=com.imttech.plantaoon)
[![Site](https://img.shields.io/badge/site-plantaoon.imtmed.com.br-16a34a?style=for-the-badge&logo=googlechrome&logoColor=white)](https://plantaoon.imtmed.com.br)

![Expo](https://img.shields.io/badge/Expo%20SDK-57-000020?style=flat-square&logo=expo&logoColor=white)
![React Native](https://img.shields.io/badge/React%20Native-0.86-61dafb?style=flat-square&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-3178c6?style=flat-square&logo=typescript&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3ecf8e?style=flat-square&logo=supabase&logoColor=white)
![RevenueCat](https://img.shields.io/badge/RevenueCat-f25a5a?style=flat-square&logo=revenuecat&logoColor=white)
![iOS](https://img.shields.io/badge/iOS-000000?style=flat-square&logo=apple&logoColor=white)
![Android](https://img.shields.io/badge/Android-3ddc84?style=flat-square&logo=android&logoColor=white)

</div>

---

## Sobre

O **Plantão ON** é um aplicativo para profissionais que trabalham em plantões, de qualquer área. Ele reúne a agenda, os locais de trabalho, o controle financeiro e os relatórios, e deixa o profissional saber quanto vai receber e onde estará em cada dia.

Os dados ficam na nuvem, vinculados à conta da pessoa, e podem ser acessados em qualquer aparelho em que ela fizer login.

<div align="center">
<img src="docs/telas.jpg" alt="Telas do aplicativo: início, calendário, financeiro, locais e mais" width="100%">
</div>

## Funcionalidades

- **Agenda de plantões.** Calendário mensal com os plantões do dia e cadastro rápido, com horário, local, valor e observações.
- **Plantões recorrentes.** Criação de plantões semanais, quinzenais ou mensais, com edição de um só ou de toda a sequência.
- **Locais por cores.** Cada local de trabalho tem a sua cor, para ver de relance onde se está em cada dia.
- **Controle financeiro.** Ganhos previstos, recebidos e a receber, plantões em atraso, gastos mensais, horas trabalhadas e saldo do período.
- **Relatórios.** Relatórios mensais e anuais em PDF e CSV, que podem ser compartilhados ou enviados por e-mail.
- **Google Agenda.** Sincronização opcional dos plantões com a agenda do Google.
- **Notificações.** Lembretes de plantões e alertas de pagamentos pendentes.
- **Importação e backup.** Importação de plantões e cópia dos dados em arquivo `.json`.
- **Login.** E-mail e senha, Google e Sign in with Apple, com complemento de perfil no primeiro acesso.
- **Assinatura.** Plano mensal e anual com 30 dias grátis, gerenciados pela App Store e pelo Google Play por meio do RevenueCat.
- **Exclusão de conta** dentro do app, como exigem as lojas.

## Tecnologias

| Área | O que usamos |
| --- | --- |
| Base | [Expo](https://expo.dev) SDK 57, React Native 0.86, React 19, TypeScript |
| Navegação | React Navigation 7 (stack e abas) |
| Backend | [Supabase](https://supabase.com): autenticação, banco Postgres com RLS e Edge Functions |
| Formulários | React Hook Form e Zod |
| Datas e calendário | Day.js e react-native-calendars |
| Assinaturas | RevenueCat (`react-native-purchases`) |
| Login social | `@react-native-google-signin/google-signin` e `expo-apple-authentication` |
| Relatórios | `expo-print`, `expo-sharing`, `expo-mail-composer` |
| Animações e ícones | Reanimated 4, react-native-svg e Lucide |
| Builds | EAS Build e EAS Submit |

## Estrutura do projeto

```text
.
├── App.tsx / index.ts        # Ponto de entrada
├── app.json / eas.json       # Configuração do Expo e do EAS
├── src/
│   ├── components/           # Componentes reutilizáveis (ui/, shifts/)
│   ├── contexts/             # Estado global: Auth, Shifts, Hospitals, Expenses, Subscription
│   ├── hooks/                # Hooks personalizados
│   ├── lib/                  # Cliente do Supabase
│   ├── navigation/           # Navegadores (raiz, autenticação, abas)
│   ├── screens/              # Telas por área
│   │   ├── auth/  onboarding/  dashboard/  shifts/  hospitals/
│   │   ├── financial/  reports/  settings/  subscription/  splash/
│   ├── services/             # Acesso a dados e integrações
│   ├── theme/                # Cores, espaçamentos e tipografia
│   ├── types/                # Tipos do banco e do domínio
│   └── utils/                # Datas, moeda, recorrência, importação etc.
└── supabase/
    ├── functions/
    │   ├── send-report-email/   # Envio de relatórios por e-mail
    │   └── delete-account/      # Exclusão de conta
    └── *.sql                    # Scripts e migrações do banco
```

## Como rodar

### Requisitos

- Node.js (LTS) e npm
- Um projeto no [Supabase](https://supabase.com)
- Para Android: Android Studio. Para iOS: um Mac com Xcode, ou o EAS Build.

> O app usa módulos nativos (login Google/Apple, RevenueCat), então **não roda no Expo Go**. É preciso um *development build*.

### Passo a passo

```bash
# 1. Instale as dependências
npm install

# 2. Crie o arquivo .env com as variáveis abaixo

# 3. Gere e rode o development build
npx expo run:android      # ou: npx expo run:ios
# ou, na nuvem:
npx eas-cli build --profile development --platform android

# 4. Inicie o servidor de desenvolvimento
npx expo start
```

### Variáveis de ambiente

Crie um arquivo `.env` na raiz. Ele **não** vai para o Git.

| Variável | Para que serve |
| --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | URL do projeto Supabase |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Chave pública (anon) do Supabase |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | Client ID web do Google Sign-In |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | Client ID iOS do Google Sign-In |
| `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` | Chave pública do RevenueCat (Android) |
| `EXPO_PUBLIC_REVENUECAT_IOS_KEY` | Chave pública do RevenueCat (iOS) |

### Supabase

1. Rode os scripts de `supabase/*.sql` no **SQL Editor** do projeto.
2. Publique as funções e configure os segredos das Edge Functions:

   ```bash
   supabase functions deploy send-report-email
   supabase functions deploy delete-account
   supabase secrets set RESEND_API_KEY=... REPORT_FROM_EMAIL="Plantão ON <nao-responda@seudominio.com.br>"
   ```

O envio de relatórios por e-mail usa o [Resend](https://resend.com), e o remetente precisa ser de um domínio verificado lá.

## Scripts

| Comando | O que faz |
| --- | --- |
| `npm start` | Inicia o servidor do Expo |
| `npm run android` | Compila e roda no Android |
| `npm run ios` | Compila e roda no iOS |
| `npm run lint` | Verifica o código com o ESLint |
| `npx tsc --noEmit` | Verifica os tipos do TypeScript |

## Publicação

As builds e os envios para as lojas são feitos com o EAS:

```bash
npx eas-cli build --profile production --platform all
npx eas-cli submit --platform ios      # App Store
npx eas-cli submit --platform android  # Google Play
```

O número da versão é gerenciado de forma remota pelo EAS e incrementado a cada build de produção.

## Segurança

- Chaves privadas, `.env`, keystores e `credentials.json` ficam fora do Git, pelo `.gitignore`.
- Só chaves **públicas** (prefixo `EXPO_PUBLIC_`) vão para o app. Segredos, como a chave do Resend e a *service role* do Supabase, existem apenas nas Edge Functions.
- O acesso aos dados no Supabase é protegido por autenticação e por regras de linha (RLS).

## Links

- 🌐 [Site oficial](https://plantaoon.imtmed.com.br)
- 🍎 [App Store](https://apps.apple.com/br/app/plant%C3%A3o-on/id6827799854)
- 🤖 [Google Play](https://play.google.com/store/apps/details?id=com.imttech.plantaoon)

## Licença e direitos

Todos os direitos reservados. O código, a identidade visual e a marca **Plantão ON** pertencem aos seus titulares e **não** podem ser copiados, redistribuídos ou usados em outros projetos sem autorização.

---

<div align="center">

**Plantão ON** · Escala de Plantões & Ganhos
Desenvolvido por Joca para Migliorini Teixeira Health Tech Ltda.

</div>
