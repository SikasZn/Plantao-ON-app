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
