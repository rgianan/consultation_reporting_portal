# CHEDRO Consultation and Dialogue Portal

A React/Vite portal based on the supplied TOSF monitoring portal's visual and technical framework. It implements the fields in Annex A, uses email verification for password recovery, and adds a consolidated Central Office admin module.

Production portal: <https://ched-consultation-reporting-portal.vercel.app/>

## Included

- CHEDRO dashboard, quarterly status and report history
- Annex A form: quarter, consultation date, four agenda categories, region-specific concerns, other matters, attendance sheet, photo documentation, and CHEDRO signatories
- Self-registration with Central Office account approval
- Regional office selected during account creation and locked after approval
- Regional submission history shared with authorized users in that office
- A single CHEDRO User role plus Central Office administration
- Official-email recovery support
- Google Sheets-backed submission records and audit trail
- Admin coverage, participant totals, concern totals, region status, and cross-CHEDRO thematic summary
- Central Office review queue filtered by CHED Regional Office, quarter, reporting year, status or free-text search, with one-click drill-down from the national coverage grid
- Full Annex A record on every submission: the four agenda discussions, region-specific concerns, other matters, linked attendance sheet and photos, and all four signatories
- Central Office validation: mark a report Validated or Needs revision with remarks, emailed to the submitting office and shown back in its regional history
- CSV export of every Annex A field for the current filter, not just reference numbers
- Responsive layouts for desktop, tablet and mobile

## Run locally

1. Run `npm install` and `npm run dev`.
2. Copy `.env.example` to `.env` and set the deployed Apps Script URL.
3. Create a private Google Drive folder for attendance sheets and consultation photos.
4. Paste `google-apps-script/Code.gs` into an Apps Script project attached to a Google Sheet.
5. In **Apps Script → Project Settings → Script properties**, add `SPREADSHEET_ID`, `DRIVE_FOLDER_ID`, `INITIAL_ADMIN_EMAIL`, `INITIAL_ADMIN_PASSWORD`, and optionally `INITIAL_ADMIN_NAME`.
6. Run `setupPortal()` once, then run `seedAdmin()` once. The initial password property is deleted after the administrator is created.
7. Deploy the script as a Web App that executes as the owner and allows access by **Anyone**. Portal access remains protected by the approved-account login and official-domain checks.
8. CHEDRO personnel create their own account and select their regional office. A Central Administrator verifies and approves the request before the account can sign in.

### Updating an already-deployed script

Saving the Apps Script editor is **not** enough: the `/exec` URL keeps serving the last published version. After pasting a new `Code.gs`, choose **Deploy → Manage deployments → Edit (pencil) → Version: New version → Deploy**. Keeping the same deployment preserves the existing `/exec` URL, so `VITE_GAS_WEB_APP_URL` does not change. Skipping this step leaves newly added actions returning `Unsupported action.` to the portal.

Registration requests remain inactive until Central Office approval, sessions are role-checked by the backend, and each report stores the submitting user's name, email, role, and approved regional office for auditability.

## Deploy to Vercel

1. Push this repository to GitHub, GitLab, or Bitbucket, then import it in Vercel.
2. Vercel will use `vercel.json` to build the Vite app and publish the `dist` directory.
3. In **Project Settings → Environment Variables**, add:
   - `VITE_GAS_WEB_APP_URL`: the deployed Google Apps Script Web App URL ending in `/exec`
   - `VITE_ALLOWED_EMAIL_DOMAIN`: `ched.gov.ph`
4. Apply both variables to Production, Preview, and Development, then deploy the project.

Vite embeds `VITE_*` values during the build, so redeploy the portal after changing either variable. For command-line deployment after signing in to Vercel, run `npx vercel` for a preview or `npx vercel --prod` for production.
