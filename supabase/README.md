# RenAI Supabase setup

This folder contains the Web App database migration. It is designed around
Supabase Auth UUIDs; it does not use the previous LINE user id.

Before production:

1. Create a separate Supabase project or take a database backup.
2. Apply the migration in `migrations/`.
3. Enable email sign-in and Google only when the Google OAuth credentials are ready.
4. Add the production callback URL to Supabase Auth.
5. Put the public URL and anon key in the Web App environment.
6. Put the service-role key only in the server environment.

Original screenshots are intentionally not represented in the schema. The API
processes uploaded images in memory and stores only structured analysis results.

Usage policy:

- Every new account receives five lifetime trial analyses. They never reset.
- Pro receives 100 analyses per Stripe subscription period.
- A successful renewal resets the Pro period counter to zero and updates the
  period start/end timestamps from Stripe.
- Cancellation keeps the profile and all analysis history, but grants no new
  credits after the paid period ends.
- Failed analyses create a refund usage event and do not consume a credit.
