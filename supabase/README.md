# Supabase setup

1. Open the project SQL Editor and run [`schema.sql`](./schema.sql).
2. In Supabase Auth settings, require email confirmation, configure the password policy, and enable leaked-password protection and MFA where available. Email confirmation is required by the current project settings. Add the website URL to the Auth redirect allowlist, including `http://localhost:3000/index.html` and `http://localhost:3000/index.html?recovery=1` for local confirmation/password resets, plus the corresponding URLs for your deployed site.
3. Keep the project URL and publishable key in `js/supabase-config.js`. The `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` entries in `backend/.env.example` document the same public values for deployment. This site is static HTML, so those environment variables are not loaded automatically by the browser. A publishable key is intended for browser use; never place a `service_role` or secret key there.
4. Sign up through TanimTech. Supabase Auth stores and verifies passwords; the app schema contains no password fields.

## Authentication email delivery

The rate-limit message is from Supabase Auth, not the website password or account schema. Supabase's default email service is for testing: it currently allows only 2 emails per hour and only delivers to addresses authorized as members of the project's team. Repeatedly requesting signup confirmation or password-reset emails will not bypass that limit.

To send confirmation and reset emails to regular users:

1. Choose an SMTP email provider (for example, [Resend](https://resend.com/docs/send-with-supabase-smtp)) and verify a sender domain/address with that provider.
2. In the Supabase Dashboard, open [Authentication → SMTP Settings](https://supabase.com/dashboard/project/azuicvyurinufaqwbkwl/auth/smtp), enable custom SMTP, and enter the provider's SMTP host, port, username, password, sender email, and sender name.
3. Keep the SMTP credentials only in the Supabase Dashboard/provider. Do not put them in website JavaScript, `.env.example`, or commit them to this repository.
4. If needed, adjust the Auth email rate limit in Supabase's [Auth rate limits](https://supabase.com/dashboard/project/azuicvyurinufaqwbkwl/auth/rate-limits) settings. Supabase applies an initial limit to newly configured SMTP.
5. After setup, request one confirmation email and check the recipient inbox and spam folder. If the project has already hit its current limit, wait for the limit to reset before testing again.

See Supabase's [custom SMTP guide](https://supabase.com/docs/guides/auth/auth-smtp) for provider-specific details.

The schema backfills existing Auth users and creates a profile row for new accounts. It uses row-level security so authenticated users can access only their own field profiles, recommendation runs, crop plans, and feedback. Manual and image-based results can both create crop plans. The image workflow stores the model result and feedback, not the uploaded photo itself. Feedback is available for offline review and does not automatically retrain or change the live model.
