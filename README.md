# SANTU BUSINESS SERVICES — Business Management App

This is a separate project. It does not modify `santu-business-hub`.

## Current working features
- Supabase email/password login
- Admin/staff role lookup from `app_roles`
- Customer Master: list, search, add, edit, delete
- Responsive dashboard

## Not built yet
Bank Details, Invoice/PDF, Payments, and Reports are planned next features. Do not treat them as completed.

## Deploy free using GitHub Pages
1. Create a **new** repository named `santu-business-services-app` (do not change or delete the existing `santu-business-hub`).
2. Upload the contents of this project to the new repository, keeping the `src` and `.github/workflows` folders in place.
3. Commit the files to the `main` branch.
4. Open repository **Settings → Pages** and set **Build and deployment → Source** to **GitHub Actions**.
5. Open the **Actions** tab. Wait for “Build and deploy to GitHub Pages” to finish successfully.
6. The site URL will be `https://santu2010sb-create.github.io/santu-business-services-app/` if the repository is owned by `santu2010sb-create`.
7. On the app's first screen, enter Supabase Project URL and the **public/anon/publishable key only**.

## Security
- Never put a Supabase `service_role` or secret key in the browser.
- Current customer RLS policies are owner-based (`owner_id = auth.uid()`), so they are per-user, not shared company data.
- Do not add real bank/customer records until RLS and role access have been reviewed and tested.
- `app_roles` should be assigned through trusted Supabase SQL, not from the client app.
