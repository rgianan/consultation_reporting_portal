/**
 * Dev-only, in-memory stand-in for the Google Apps Script backend.
 *
 * It mirrors the request/response contract of `google-apps-script/Code.gs` so
 * `npm run dev` works with no Google account, no deployed Web App, and no risk
 * of writing test data into the production Sheet. It is a Vite plugin scoped to
 * `apply: "serve"`, so it is never part of a production build.
 *
 * State lives in memory only: restarting the dev server resets everything back
 * to the seed data below. Emails are printed to the terminal instead of sent.
 */
import { loadEnv } from "vite";

const MOCK_PATH = "/__mock-api";
const DOMAIN = "ched.gov.ph";
const REGIONS = [
  "NCR",
  "CAR",
  "Region I",
  "Region II",
  "Region III",
  "Region IV-A",
  "MIMAROPA",
  "Region V",
  "Region VI",
  "NIR",
  "Region VII",
  "Region VIII",
  "Region IX",
  "Region X",
  "Region XI",
  "Region XII",
  "CARAGA",
];
const STATUSES = ["For review", "Validated", "Needs revision"];
const SUPERSEDED = "Superseded";
// Mirrors the allowlist and bound enforced in Code.gs.
const QUARTERS = ["1st Quarter", "2nd Quarter", "3rd Quarter", "4th Quarter"];
const MAX_PARTICIPANTS = 1000000;
const CENTRAL_OFFICE = "Central Office";
const INVITE_TTL_DAYS = 7;
/** Reporting year of a seeded or submitted row, matching year_() in Code.gs. */
const yearOfRow = (r) =>
  (String(r.date || "").match(/(?:19|20)\d{2}/) ||
    String(r.timestamp || "").match(/(?:19|20)\d{2}/) || [""])[0];
// Matches LOGIN_MAX_FAILURES / OTP_GLOBAL_CAP in Code.gs. The mock has no
// clock-based window: the counters reset when the dev server restarts.
const LOGIN_MAX_FAILURES = 8;
const OTP_GLOBAL_CAP = 60;
const PORTAL_NAME = "CHED-OSDS Consultation & Dialogue Reporting Portal";
const ADMIN = { email: "admin@ched.gov.ph", password: "portal-admin-2026" };
const OFFICER = {
  email: "rdelacruz@ched.gov.ph",
  password: "region7-user-2026",
};
// Seeded unapproved, and its region (CARAGA) owns a "Needs revision" report --
// approving it is the quickest way to exercise the regional revision flow.
const PENDING = {
  email: "jcruz@ched.gov.ph",
  password: "pending-user-2026",
};

/** Errors flagged `expected` are portal validation messages, not stub bugs. */
const fail = (message) => {
  const e = new Error(message);
  e.expected = true;
  return e;
};
/** Mirrors authError_() in Code.gs: tells the portal the session is finished
 * so it returns the user to sign-in instead of failing every later request. */
const failSession = (message) => {
  const e = fail(message);
  e.code = "SESSION";
  return e;
};

/** Mirrors clean_() in Code.gs: drops control characters, trims, and leaves
 * angle brackets alone so submitted text is stored as it was written. */
const clean = (v) =>
  String(v == null ? "" : v)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim();
/** Mirrors text_(): normalised and truncated, for incidental lengths. */
const text = (v, n) => clean(v).slice(0, n || 500);
/** Mirrors field_(): over-long values are refused, not quietly shortened. */
const field = (v, n, label) => {
  const s = clean(v);
  if (s.length > n)
    throw fail(
      label +
        " is " +
        s.length +
        " characters long. Please shorten it to " +
        n +
        " or fewer.",
    );
  return s;
};

const asEmail = (v) => {
  const e = text(v, 254).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : "";
};

const requireDomain = (e) => {
  if (e.split("@")[1] !== DOMAIN)
    throw fail("Please use your @" + DOMAIN + " email address.");
};

function seed() {
  const year = String(new Date().getFullYear());
  const report = (n, region, quarter, status, remarks) => ({
    timestamp: year + "-03-01 09:0" + n + ":00",
    id: "CDR-" + year + "0301-000" + n,
    region,
    quarter,
    date: year + "-03-0" + n,
    participants: 40 + n * 13,
    initiatives:
      "Briefed HEIs on the free higher education subsidy and the revised CMO on student affairs.",
    student:
      "Delayed release of student financial assistance; request for additional guidance counsellors.",
    academic:
      "Concerns on limited OJT placement slots and the shift to outcomes-based curricula.",
    governance:
      "Students sought representation in HEI governing boards and clearer tuition consultation rules.",
    regionConcerns:
      "Transport and connectivity costs for students across " + region + ".",
    otherMatters: "None",
    attendanceFile: MOCK_PATH + "/file/attendance-" + n,
    photoFiles:
      MOCK_PATH +
      "/file/photo-" +
      n +
      "a\n" +
      MOCK_PATH +
      "/file/photo-" +
      n +
      "b",
    presidedBy: "Dir. J. Reyes, Regional Director",
    rapporteur: "A. Cruz, Education Supervisor II",
    certifiedBy: "L. Mendoza, Chief Administrative Officer",
    notedBy: "Dir. J. Reyes",
    submittedByEmail: OFFICER.email,
    submittedBy: "R. Dela Cruz",
    submittedByRole: "chedro_user",
    status,
    remarks: remarks || "",
  });
  return {
    users: [
      {
        email: ADMIN.email,
        password: ADMIN.password,
        name: "Portal Administrator",
        role: "central_admin",
        region: "Central Office",
        status: "Approved",
      },
      {
        email: OFFICER.email,
        password: OFFICER.password,
        name: "R. Dela Cruz",
        role: "chedro_user",
        region: "Region VII",
        status: "Approved",
      },
      {
        email: PENDING.email,
        password: PENDING.password,
        name: "Jane Cruz",
        role: "chedro_user",
        region: "CARAGA",
        status: "Pending",
      },
    ],
    reports: [
      report(1, "Region VII", "1st Quarter", "Validated"),
      report(2, "NCR", "1st Quarter", "For review"),
      report(
        3,
        "CARAGA",
        "1st Quarter",
        "Needs revision",
        "Attendance sheet is unsigned; please re-upload.",
      ),
      report(4, "Region VII", "2nd Quarter", "For review"),
    ],
    sessions: new Map(),
    otps: new Map(),
    // email -> failed sign-in count, mirroring the fixed-window throttle in
    // Code.gs so the lockout is reachable in dev too.
    loginFailures: new Map(),
    // email -> revocation timestamp, mirroring revoke_() in Code.gs.
    revoked: new Map(),
    otpMailCount: 0,
    counter: 5,
  };
}

let db = seed();

const newToken = () =>
  Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);

const findUser = (e) => db.users.find((u) => u.email === asEmail(e));
/** Mirrors reclaimable_(): a rejected row still holds its email address, so
 * it is rewritten rather than blocking that address forever. */
const reclaimable = (u) => !!u && u.status === "Rejected";
/** Mirrors findInvite_(): matched on the token, never on a supplied email. */
function findInvite(token) {
  const t = String(token || "");
  const u = t && db.users.find((x) => x.inviteToken && x.inviteToken === t);
  if (!u) throw fail("This invitation link is not valid.");
  if (u.status !== "Invited")
    throw fail("This invitation has already been used.");
  if (Number(u.inviteExpires) < Date.now())
    throw fail(
      "This invitation has expired. Ask Central Office to send a new one.",
    );
  return u;
}

function session(t, roles) {
  const s = db.sessions.get(String(t || ""));
  if (!s) throw failSession("Your session expired. Please sign in again.");
  // Same revocation stamp as Code.gs: rejecting an account or resetting its
  // password ends any session already open on it.
  const revoked = db.revoked.get(s.email);
  if (revoked && revoked > (s.issued || 0))
    throw failSession(
      "Your access changed and this session has ended. Please sign in again.",
    );
  if (roles && roles.indexOf(s.role) < 0)
    throw fail("You do not have permission for this action.");
  return s;
}

/** Prints where a real deployment would send mail. */
function mail(to, subject, body) {
  console.log(
    "\n  [mock email] to " +
      to +
      "\n    " +
      subject +
      "\n    " +
      String(body)
        .replace(/<[^>]*>/g, "")
        .trim() +
      "\n",
  );
  return { sent: true, warning: "" };
}

/** The row shape both list endpoints return, matching Code.gs. */
const publicReport = (r) => ({
  timestamp: r.timestamp,
  id: r.id,
  region: r.region,
  quarter: r.quarter,
  date: r.date,
  participants: r.participants,
  initiatives: r.initiatives,
  student: r.student,
  academic: r.academic,
  governance: r.governance,
  regionConcerns: r.regionConcerns,
  otherMatters: r.otherMatters,
  attendanceFile: r.attendanceFile,
  photoFiles: r.photoFiles,
  presidedBy: r.presidedBy,
  rapporteur: r.rapporteur,
  certifiedBy: r.certifiedBy,
  notedBy: r.notedBy,
  submittedBy: r.submittedBy,
  status: r.status,
  remarks: r.remarks,
});

const actions = {
  accountLogin(p) {
    const email = asEmail(p.email),
      u = findUser(p.email),
      password = String(p.password || "");
    if ((db.loginFailures.get(email) || 0) >= LOGIN_MAX_FAILURES)
      throw fail(
        "Too many sign-in attempts for this account. Please wait a few " +
          "minutes and try again, or reset your password.",
      );
    if (u && u.status === "Pending")
      throw fail("Your account is awaiting Central Office approval.");
    if (u && u.status === "Rejected")
      throw fail(
        "Your account request was not approved. Contact Central Office for assistance.",
      );
    if (!u || u.password !== password) {
      db.loginFailures.set(email, (db.loginFailures.get(email) || 0) + 1);
      throw fail("Invalid credentials or inactive account.");
    }
    db.loginFailures.delete(email);
    const t = newToken();
    db.sessions.set(t, {
      email: u.email,
      name: u.name,
      role: u.role,
      region: u.region,
      issued: Date.now(),
    });
    return {
      accountToken: t,
      email: u.email,
      displayName: u.name,
      role: u.role,
      region: u.region,
    };
  },

  registerAccount(p) {
    const email = asEmail(p.email),
      name = field(p.name, 200, "Full name"),
      region = text(p.region, 80);
    if (!email || !name || REGIONS.indexOf(region) < 0)
      throw fail("Enter your name, official email and CHED Regional Office.");
    requireDomain(email);
    if (String(p.password || "").length < 12)
      throw fail("Use a password of at least 12 characters.");
    const existing = findUser(email);
    if (existing && !reclaimable(existing))
      throw fail("An account request already exists for this email.");
    const fresh = {
      email,
      password: String(p.password),
      name,
      role: "chedro_user",
      region,
      status: "Pending",
      inviteToken: "",
      inviteExpires: 0,
    };
    if (existing) Object.assign(existing, fresh);
    else db.users.push(fresh);
    return {
      message:
        "Account request submitted. Central Office will review your regional assignment before you can sign in.",
    };
  },

  // ---- Central Office invitations, mirroring Code.gs ----
  inviteAccount(p) {
    const admin = session(p.accountToken, ["central_admin"]);
    const email = asEmail(p.email),
      name = field(p.name, 200, "Full name"),
      role = text(p.role, 40) || "chedro_user",
      region = role === "central_admin" ? CENTRAL_OFFICE : text(p.region, 80);
    if (role !== "chedro_user" && role !== "central_admin")
      throw fail("Choose a portal role for this account.");
    if (!email || !name)
      throw fail("Enter the name and official email address.");
    if (role === "chedro_user" && REGIONS.indexOf(region) < 0)
      throw fail("Select the CHED Regional Office for this account.");
    requireDomain(email);
    const existing = findUser(email);
    if (existing && !reclaimable(existing))
      throw fail("An account already exists for this email address.");
    const token = newToken();
    const fresh = {
      email,
      password: "",
      name,
      role,
      region,
      status: "Invited",
      inviteToken: token,
      inviteExpires: Date.now() + INVITE_TTL_DAYS * 86400000,
    };
    if (existing) Object.assign(existing, fresh);
    else db.users.push(fresh);
    mail(
      email,
      PORTAL_NAME + ": You have been invited to the portal",
      "Set up your portal account.\n    Sign in with: " +
        email +
        "\n    " +
        (role === "central_admin"
          ? "Role: Central Office Administrator"
          : "Regional office: " + region) +
        "\n    Accept the invitation: /?invite=" +
        token,
    );
    if (role === "central_admin")
      db.users
        .filter((u) => u.role === "central_admin" && u.status === "Approved")
        .forEach((a) =>
          mail(
            a.email,
            PORTAL_NAME + ": A new Central Office administrator was invited",
            name + " (" + email + ") was invited by " + admin.email + ".",
          ),
        );
    return {
      email,
      notified: true,
      message: "Invitation sent to " + email + ".",
    };
  },

  resendInvite(p) {
    session(p.accountToken, ["central_admin"]);
    const u = findUser(p.email);
    if (!u || u.status !== "Invited")
      throw fail("No outstanding invitation for this email address.");
    // Reissuing retires the previous token, as in Code.gs.
    u.inviteToken = newToken();
    u.inviteExpires = Date.now() + INVITE_TTL_DAYS * 86400000;
    mail(
      u.email,
      PORTAL_NAME + ": You have been invited to the portal",
      "Accept the invitation: /?invite=" + u.inviteToken,
    );
    return { notified: true, message: "Invitation resent to " + u.email + "." };
  },

  revokeInvite(p) {
    session(p.accountToken, ["central_admin"]);
    const u = findUser(p.email);
    if (!u || u.status !== "Invited")
      throw fail("No outstanding invitation for this email address.");
    u.status = "Rejected";
    u.inviteToken = "";
    u.inviteExpires = 0;
    return { message: "Invitation withdrawn." };
  },

  inviteDetails(p) {
    const u = findInvite(p.inviteToken);
    return { email: u.email, name: u.name, role: u.role, region: u.region };
  },

  acceptInvite(p) {
    const u = findInvite(p.inviteToken);
    if (String(p.password || "").length < 12)
      throw fail("Use a password of at least 12 characters.");
    u.password = String(p.password);
    u.status = "Approved";
    u.inviteToken = "";
    u.inviteExpires = 0;
    return {
      email: u.email,
      message: "Your account is ready. You can now sign in.",
    };
  },

  listAccounts(p) {
    session(p.accountToken, ["central_admin"]);
    return {
      rows: db.users.map((u) => ({
        name: u.name,
        email: u.email,
        region: u.region,
        role: u.role,
        status: u.status,
      })),
    };
  },

  approveAccount(p) {
    session(p.accountToken, ["central_admin"]);
    const approve = p.approve !== false,
      u = findUser(p.email);
    if (!u || u.role !== "chedro_user")
      throw fail("Account request not found.");
    // Mirrors Code.gs: approving an invitation would mark the account Active
    // with no password, so it would show as usable and refuse every sign-in.
    if (u.status === "Invited")
      throw fail(
        "This account has an outstanding invitation. Resend or revoke it instead.",
      );
    if (approve && !u.password)
      throw fail("This account has no password set, so it cannot be approved.");
    u.status = approve ? "Approved" : "Rejected";
    db.revoked.set(u.email, Date.now());
    const decision = approve ? "Account approved." : "Account rejected.";
    const notice = mail(
      u.email,
      PORTAL_NAME +
        ": " +
        (approve ? "Account approved" : "Account request reviewed"),
      approve
        ? [
            "Your portal account has been approved.",
            "  Name: " + u.name,
            "  Regional office: " + u.region,
            "  Sign in with: " + u.email,
            "One Annex A report is required each quarter.",
          ].join("\n    ")
        : [
            "Your portal account request was not approved.",
            "  Office requested: " + u.region,
            "Contact Central Office, then register again.",
          ].join("\n    "),
    );
    return {
      notified: notice.sent,
      message: notice.sent ? decision : decision + " " + notice.warning,
    };
  },

  listRegionalSubmissions(p) {
    const u = session(p.accountToken, ["chedro_user"]);
    return {
      region: u.region,
      rows: db.reports.filter((r) => r.region === u.region).map(publicReport),
    };
  },

  adminDashboard(p) {
    session(p.accountToken, ["central_admin", "central_reviewer"]);
    return { rows: db.reports.map(publicReport) };
  },

  submitDialogue(p) {
    const u = session(p.accountToken, ["chedro_user"]);
    [
      "region",
      "quarter",
      "date",
      "presidedBy",
      "rapporteur",
      "certifiedBy",
      "notedBy",
    ].forEach((k) => {
      if (!text(p[k], 500)) throw fail("Missing required field: " + k);
    });
    if (p.region !== u.region)
      throw fail("You can only submit reports for " + u.region + ".");
    const date = text(p.date, 30),
      quarter = text(p.quarter, 30);
    if (QUARTERS.indexOf(quarter) < 0)
      throw fail("Select a reporting quarter from the list.");
    if (Number(p.participants) > MAX_PARTICIPANTS)
      throw fail("Check the total participants figure.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
      throw fail("Enter the consultation date as YYYY-MM-DD.");
    if (date > new Date().toISOString().slice(0, 10))
      throw fail("The consultation date cannot be in the future.");
    const year = date.slice(0, 4);
    // One live report per office per quarter, as in Code.gs: a returned report
    // is superseded by its replacement, anything else has to be returned first.
    const clash = db.reports.find(
      (r) =>
        r.region === u.region &&
        r.quarter === quarter &&
        yearOfRow(r) === year &&
        r.status !== SUPERSEDED,
    );
    if (clash && clash.status !== "Needs revision")
      throw fail(
        "A " +
          quarter +
          " " +
          year +
          " report (" +
          clash.id +
          ") is already on file for " +
          u.region +
          " and is marked “" +
          clash.status +
          "”. Ask Central Office to return it for revision before " +
          "filing a replacement.",
      );
    if (!p.attendanceFile) throw fail("Attendance sheet is required.");
    const photos = Array.isArray(p.photoFiles) ? p.photoFiles : [];
    if (!photos.length) throw fail("Photo documentation is required.");
    if (photos.length > 5) throw fail("Attach no more than 5 photos.");
    const n = db.counter++,
      notes = p.notes || {},
      id =
        "CDR-" +
        text(p.date, 30).replace(/\D/g, "").slice(0, 8) +
        "-" +
        String(n).padStart(4, "0");
    // Attachments are acknowledged by name only; the base64 payload is dropped
    // so the dev server does not hold report-sized blobs in memory.
    db.reports.push({
      timestamp: new Date().toISOString().slice(0, 19).replace("T", " "),
      id,
      region: text(p.region, 80),
      quarter: text(p.quarter, 30),
      date: text(p.date, 30),
      participants: Number(p.participants) || 0,
      initiatives: field(
        notes.initiatives,
        5000,
        "CHED initiatives, programs and policies",
      ),
      student: field(notes.student, 5000, "Student welfare concerns"),
      academic: field(notes.academic, 5000, "Curriculum and academic programs"),
      governance: field(notes.governance, 5000, "HEI governance concerns"),
      regionConcerns: field(p.regionConcerns, 5000, "Region-specific concerns"),
      otherMatters: field(p.otherMatters, 5000, "Other matters"),
      attendanceFile:
        MOCK_PATH +
        "/file/" +
        encodeURIComponent(p.attendanceFile.name || "attendance"),
      photoFiles: photos
        .map(
          (f, i) =>
            MOCK_PATH + "/file/" + encodeURIComponent(f.name || "photo-" + i),
        )
        .join("\n"),
      presidedBy: field(p.presidedBy, 300, "Presided by"),
      rapporteur: field(p.rapporteur, 300, "Rapporteur"),
      certifiedBy: field(p.certifiedBy, 300, "Certified correct by"),
      notedBy: field(p.notedBy, 300, "Noted by"),
      submittedByEmail: u.email,
      submittedBy: u.name,
      submittedByRole: u.role,
      status: "For review",
      remarks: "",
    });
    let replaced = "";
    if (clash) {
      replaced = clash.id;
      clash.status = SUPERSEDED;
      clash.remarks = (
        (clash.remarks ? clash.remarks + " " : "") +
        "[Replaced by " +
        id +
        " on " +
        new Date().toISOString().slice(0, 10) +
        "]"
      ).slice(0, 2000);
    }
    return {
      submissionId: id,
      replaced,
      message:
        "Consultation report submitted." +
        (replaced ? " It replaces " + replaced + "." : ""),
    };
  },

  reviewSubmission(p) {
    session(p.accountToken, ["central_admin", "central_reviewer"]);
    const reference = text(p.reference, 60),
      status = text(p.status, 40),
      remarks = field(p.remarks, 2000, "Remarks");
    if (!reference) throw fail("Missing report reference.");
    if (STATUSES.indexOf(status) < 0) throw fail("Unsupported status.");
    if (status === "Needs revision" && !remarks)
      throw fail("Enter remarks explaining what the CHEDRO must revise.");
    const r = db.reports.find((x) => x.id === reference);
    if (!r) throw fail("Report " + reference + " was not found.");
    if (r.status === SUPERSEDED)
      throw fail(
        "Report " +
          reference +
          " was replaced by a later submission and can no longer be reviewed.",
      );
    r.status = status;
    r.remarks = remarks;
    let notice = { sent: true, warning: "" };
    if (r.submittedByEmail && status !== "For review")
      notice = mail(
        r.submittedByEmail,
        PORTAL_NAME +
          ": " +
          (status === "Needs revision"
            ? "Report returned for revision"
            : "Report validated") +
          " (" +
          reference +
          ")",
        [
          status === "Needs revision"
            ? "Central Office returned this report for revision."
            : "Central Office validated this report.",
          "  Reference: " + reference,
          "  Regional office: " + r.region,
          "  Quarter: " + r.quarter,
          "  Consultation date: " + r.date,
          "  Status: " + status,
        ]
          .concat(remarks ? ["  Remarks: " + remarks] : [])
          .join("\n    "),
      );
    return {
      reference,
      status,
      remarks,
      notified: notice.sent,
      message:
        "Report marked " +
        status +
        "." +
        (notice.sent ? "" : " " + notice.warning),
    };
  },

  // Deliberately uninformative, like Code.gs: an address with no approved
  // account gets an identical response and an OTP that simply never arrives,
  // so the endpoint cannot be used to enumerate staff or to mail them.
  requestEmailOtp(p) {
    const email = asEmail(p.email);
    if (!email) throw fail("Enter a valid official email address.");
    requireDomain(email);
    const id = newToken(),
      code = String(Math.floor(100000 + Math.random() * 900000));
    db.otps.set(id, { email, code });
    const reply = {
      otpRequestId: id,
      message:
        "If " +
        email +
        " has an approved portal account, a six-digit code is on its way.",
    };
    const u = findUser(email);
    if (!u || u.status !== "Approved") {
      console.log(
        "\n  [mock email] suppressed: no approved account for " + email + "\n",
      );
      return reply;
    }
    if (++db.otpMailCount > OTP_GLOBAL_CAP) {
      console.log("\n  [mock email] suppressed: hourly reset-email cap\n");
      return reply;
    }
    mail(
      email,
      PORTAL_NAME + ": Password reset code",
      "Your verification code is " +
        code +
        ", valid for 10 minutes.\n    Do not share it. Ignore this email if you did not request a reset.",
    );
    return reply;
  },

  verifyEmailOtp(p) {
    const key = String(p.otpRequestId || ""),
      r = db.otps.get(key);
    if (!r) throw fail("Verification code expired. Request a new code.");
    if (String(p.otpCode || "").replace(/\D/g, "") !== r.code)
      throw fail("Invalid verification code.");
    db.otps.delete(key);
    const t = newToken();
    db.sessions.set("otp:" + t, { email: r.email });
    return { email: r.email, otpSessionToken: t };
  },

  resetPassword(p) {
    const s = db.sessions.get("otp:" + String(p.otpSessionToken || ""));
    if (!s) throw fail("Email verification expired. Please verify again.");
    if (String(p.password || "").length < 12)
      throw fail("Use a password of at least 12 characters.");
    const u = findUser(s.email);
    if (!u || u.status !== "Approved")
      throw fail("Approved account not found.");
    u.password = String(p.password);
    // A reset ends any session open on the account, and spends the token that
    // authorised it -- both as in Code.gs.
    db.revoked.set(u.email, Date.now());
    db.sessions.delete("otp:" + String(p.otpSessionToken || ""));
    return { message: "Password updated. You may now sign in." };
  },
};

function banner() {
  const rule = "------------------------------------------------------------";
  console.log(
    [
      "",
      "  " + rule,
      "  CHEDRO mock backend active",
      "",
      "  VITE_GAS_WEB_APP_URL is unset, so the portal is talking to an",
      "  in-memory stub. No Google Sheet is touched and nothing persists",
      "  across restarts. Set VITE_GAS_WEB_APP_URL in .env to opt out.",
      "",
      "    Central Office  " + ADMIN.email + "  /  " + ADMIN.password,
      "    Region VII      " + OFFICER.email + "  /  " + OFFICER.password,
      "    CARAGA          " + PENDING.email + "  /  " + PENDING.password,
      "                    unapproved on purpose - approve it from Central",
      "                    Office to test the regional revision flow",
      "  " + rule,
      "",
    ].join("\n"),
  );
}

export function mockBackend() {
  let enabled = false;
  return {
    name: "chedro-mock-backend",
    apply: "serve",
    config(_conf, { mode }) {
      const env = loadEnv(mode, process.cwd(), "");
      enabled = !env.VITE_GAS_WEB_APP_URL;
      if (!enabled) return;
      // Point the client at the stub without requiring a .env file.
      return {
        define: {
          "import.meta.env.VITE_GAS_WEB_APP_URL": JSON.stringify(MOCK_PATH),
        },
      };
    },
    configureServer(server) {
      if (!enabled) return;
      db = seed();
      banner();
      server.middlewares.use(MOCK_PATH, (req, res, next) => {
        if (req.method !== "POST") return next();
        let body = "";
        req.on("data", (c) => (body += c));
        req.on("end", () => {
          let out;
          try {
            const payload = JSON.parse(body || "{}");
            const handler = Object.prototype.hasOwnProperty.call(
              actions,
              payload.action,
            )
              ? actions[payload.action]
              : null;
            if (!handler) throw fail("Unsupported action.");
            out = { ok: true, ...handler(payload) };
          } catch (err) {
            if (!err.expected) console.error("  mock backend error:", err);
            out = {
              ok: false,
              code: err.code || "",
              message: err.message || String(err),
            };
          }
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(out));
        });
      });
    },
  };
}
