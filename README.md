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
- Admin coverage, participant totals, concern totals and region status
- Themes & actions: every concern the CHEDROs raised, split back out of the agenda sections, ranked by what recurs across offices and searchable in full — see below
- Central Office review queue filtered by CHED Regional Office, quarter, reporting year, status or free-text search, with one-click drill-down from the national coverage grid
- Full Annex A record on every submission: the four agenda discussions, region-specific concerns, other matters, linked attendance sheet and photos, and all four signatories
- Central Office validation: mark a report Validated or Needs revision with remarks, emailed to the submitting office and shown back in its regional history
- CSV export of every Annex A field for the current filter, not just reference numbers
- Responsive layouts for desktop, tablet and mobile

## Run locally

Run `npm install` then `npm run dev`. With no `.env` file the portal starts against
a built-in mock backend and is immediately usable — no Google account, no deployed
script, and nothing written to any Sheet:

| Sign in as | Email | Password |
| --- | --- | --- |
| Central Office | `admin@ched.gov.ph` | `portal-admin-2026` |
| Region VII officer | `rdelacruz@ched.gov.ph` | `region7-user-2026` |
| CARAGA officer | `jcruz@ched.gov.ph` | `pending-user-2026` |

The CARAGA account is seeded **unapproved** on purpose, and CARAGA owns the one
seeded report in `Needs revision`. Approving it from Central Office and then
signing in as it walks the whole regional path in about a minute: blocked login →
approval → revision banner → remarks.

Four reports are seeded across three regions and quarters, so the coverage grid,
validation queue and approval queue all have content. Verification codes and
notification emails are printed to the terminal instead of being sent. State is in
memory: restarting `npm run dev` resets everything to seed.

The mock lives in `dev/mock-backend.js`, is wired up by `vite.config.js`, and is
scoped to `apply: "serve"` — it is never part of a production build.

### Testing as a regional office

`sessionStorage` is per tab, so you can hold two roles at once — open
`localhost:5173` in one tab as Central Office and a second tab as a CHEDRO user,
and refresh either to see the other's changes.

1. **Sign in as Region VII** (`rdelacruz@…`) to land on a populated workspace: three
   reports, the quarterly timeline, and a current-quarter card.
2. **File a report** with *New report*. The office is locked to your account, so only
   the quarter and date are yours to pick. Any small PDF and any image satisfy the
   attendance and photo steps — the mock records filenames and discards the bytes.
3. **Switch to Central Office**, open *Submissions*, filter to that CHEDRO, expand
   the row and *Return for revision* with remarks.
4. **Back on the regional tab**, refresh: the red banner appears and the remarks
   show inside the report. Validate it from Central Office and the banner clears.

To test a region that has no seed data, register a fresh account for it from
*Create account*, then approve it as Central Office. To pre-seed one instead, add
it to the `users` array in `seed()` in `dev/mock-backend.js`.

### Running against a real backend

**Localhost does not mean local data.** The dev server only serves the UI; every
request goes to whatever `VITE_GAS_WEB_APP_URL` points at. Setting it to the
production `/exec` URL means accounts you create and reports you submit are written
to the live Google Sheet. For hands-on testing against real Apps Script, deploy a
second script bound to a separate Sheet and Drive folder and point `.env` at that.

## Connect the Google backend
1. Create a private Google Drive folder for attendance sheets and consultation photos.
2. Paste `google-apps-script/Code.gs` into an Apps Script project attached to a Google Sheet.
3. In **Apps Script → Project Settings → Script properties**, add `SPREADSHEET_ID`, `DRIVE_FOLDER_ID`, `INITIAL_ADMIN_EMAIL`, `INITIAL_ADMIN_PASSWORD`, and optionally `INITIAL_ADMIN_NAME`, `PORTAL_URL` and `ATTACHMENT_SHARING`. `PORTAL_URL` is the address the "Open the portal" button in notification emails points at; it defaults to the production Vercel URL. `ATTACHMENT_SHARING` decides who can open an attendance sheet or photo link — see below; it defaults to `domain`.
4. Run `setupPortal()` once, then run `seedAdmin()` once. The initial password property is deleted after the administrator is created.
5. Deploy the script as a Web App that executes as the owner and allows access by **Anyone**. Portal access remains protected by the approved-account login and official-domain checks.
6. Copy that `/exec` URL into `.env` as `VITE_GAS_WEB_APP_URL`, which also switches the dev server off the mock backend.
7. CHEDRO personnel create their own account and select their regional office. A Central Administrator verifies and approves the request before the account can sign in.

### OTP_SECRET is also the password pepper

`setupPortal()` generates `OTP_SECRET` once. It signs verification codes **and**
peppers every stored password hash, so **it must never be rotated or cleared
once accounts exist** — changing it invalidates every password in the portal at
the same moment, with no way back. Back it up with the rest of your deployment
configuration. If it is missing, account creation and sign-in now fail loudly
rather than quietly hashing against a known key.

### When a session ends

Sessions last two hours. They also end immediately when Central Office rejects
the account or when its password is reset, rather than lingering until they
expire. The portal recognises this and returns the user to the sign-in screen
with a short explanation instead of leaving them on a page where nothing loads.

An administrator editing the **Users** sheet by hand is not noticed until the
session expires on its own — use the *User access* screen to reject an account
if you need it to stop working now.

### Who can open attachment links

Attendance sheets and photos live in the private Drive folder and are owned by
the account the script runs as. Left alone, every link the portal shows a
reviewer opens on a **Request access** page, so each report folder is shared
when it is created. `ATTACHMENT_SHARING` chooses how:

| Value | Who can open a link |
| --- | --- |
| `domain` (default) | anyone signed in to your `ALLOWED_EMAIL_DOMAIN` Google Workspace who has the link. Keeps student data inside CHED. |
| `anyone` | anyone at all who has the link. Only for deployments whose owner is not on a Workspace domain, where `domain` is unavailable. Attendance sheets carry student names, so choose this deliberately. |
| `private` | nothing is shared. Links open for the script owner alone. |

If `domain` is rejected — which happens when the owning account is not on a
Workspace domain — the script falls back to naming the current Central Office
and regional users as viewers on that one folder, warns the submitter, and logs
`attachment_sharing_failed` to the Audit Log. That fallback is exact but frozen:
an officer approved later will not inherit access to older folders.

Reports filed before attachment sharing existed still have unshared folders.
Run **`repairAttachmentSharing()`** once from the Apps Script editor to apply
the configured sharing to every report folder already in Drive. It is safe to
re-run.

### One live report per office per quarter

The backend allows a single live report per regional office, quarter and
reporting year. Filing a second one is refused while the first is `For review`
or `Validated` — Central Office has to return it for revision first, which is
what the **Return for revision** button is for.

Once a report is returned, the office's next submission for that quarter
replaces it: the old row is marked `Superseded`, keeps its remarks, gains a
`[Replaced by …]` note, and drops out of every count, the coverage grid, the
compliance checks and the quarterly timeline. It stays on the sheet for the
audit trail and is still readable in the portal by choosing **Superseded** in
the status filter, but it can no longer be validated or returned.

Consultation dates are stored as `YYYY-MM-DD` and cannot be in the future,
since the reporting year is read back off that column.

### How Themes & actions summarises the reports

Offices file each agenda section as a semicolon-separated list, so the section
is not the unit of analysis — the individual concerns inside it are. The module
splits them back out, attributes each to the office that raised it, and reads
across offices:

- **What is recurring across CHEDROs** ranks terms appearing in concerns from
  more than one regional office. Expanding a theme lists the concerns behind
  it, quoted as written, with the office and agenda area for each.
- **Concerns by agenda area** lists every concern in Annex A order.
- The search box filters every concern, and narrows the themes above with it.

This is keyword matching with crude singularisation, **not** language
understanding. The ranking is a way into the text, never a substitute for
reading it — which is why every count opens onto the concerns that produced it.
Agency names such as "CHED" are excluded from the ranking because they appear in
nearly every concern by definition. "None raised", "N/A" and similar are read as
nothing reported rather than as a concern.

### Submitted text is stored as written

Report narrative is no longer altered on its way into the Sheet. Angle brackets
used to be stripped from every field as a blanket XSS measure, which quietly
rewrote submissions — "cohorts of < 30 students" was stored as "cohorts of  30
students", permanently, in an official record. Only control characters that
would corrupt a sheet cell or a CSV row are removed now.

That makes `esc_()` the only thing standing between stored text and the HTML
half of a notification email, so **every value interpolated into `emailBody_()`
must go through it**. The plain-text half needs no escaping.

Fields that are too long are **refused with the field named**, rather than
stored truncated: agenda discussions, region-specific concerns and other
matters cap at 5,000 characters, signatories at 300, and Central Office remarks
at 2,000. The portal shows a character counter as a field approaches its cap
and turns it red past it. Inputs carry no `maxLength` on purpose — silently
swallowing the tail of a paste is the same data loss moved into the browser.

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
