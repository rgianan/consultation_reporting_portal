# CHEDRO Consultation and Dialogue Portal

A React/Vite portal based on the supplied TOSF monitoring portal's visual and technical framework. It implements the fields in Annex A, uses email verification for password recovery, and adds a consolidated Central Office admin module.

## Included

- CHEDRO dashboard, quarterly status and report history
- Annex A form: quarter, consultation date, four agenda categories, region-specific concerns, other matters, attendance sheet, photo documentation, and CHEDRO signatories
- Self-registration with Central Office account approval
- Regional office selected during account creation and locked after approval
- Regional submission history shared with authorized users in that office
- A single CHEDRO User role plus Central Office administration
- Official-email recovery support
- Google Sheets-backed submission records and audit trail
- Admin coverage, validation queue, participant totals, concern totals, region status, export affordance, and cross-CHEDRO thematic summary
- Responsive layouts for desktop, tablet and mobile

## Run locally

1. Run `npm install` and `npm run dev`.
2. Copy `.env.example` to `.env` and set the deployed Apps Script URL.
3. Create a private Google Drive folder for attendance sheets and consultation photos.
4. Paste `google-apps-script/Code.gs` into an Apps Script project attached to a Google Sheet.
5. Add the Sheet and Drive folder IDs in `setupPortal()`, run it once, then deploy as a Web App. Change the placeholder in `seedAdmin()` before running it.
6. CHEDRO personnel create their own account and select their regional office. A Central Administrator verifies and approves the request before the account can sign in.

The UI includes explicit CHEDRO and Central Office preview buttons until a deployed backend is connected. In production, registration requests remain inactive until Central Office approval, sessions are role-checked by the backend, and each report stores the submitting user's name, email, role, and approved regional office for auditability.
