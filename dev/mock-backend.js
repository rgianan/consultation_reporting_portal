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

/** Mirrors text_() in Code.gs: strips angle brackets, trims, caps length. */
const text = (v, n) =>
  String(v == null ? "" : v)
    .replace(/[<>]/g, "")
    .trim()
    .slice(0, n || 500);

const asEmail = (v) => {
  const e = text(v, 254).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : "";
};

/** Errors flagged `expected` are portal validation messages, not stub bugs. */
const fail = (message) => {
  const e = new Error(message);
  e.expected = true;
  return e;
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
      MOCK_PATH + "/file/photo-" + n + "a\n" + MOCK_PATH + "/file/photo-" + n + "b",
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
    counter: 5,
  };
}

let db = seed();

const newToken = () =>
  Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);

const findUser = (e) => db.users.find((u) => u.email === asEmail(e));

function session(t, roles) {
  const s = db.sessions.get(String(t || ""));
  if (!s) throw fail("Your session expired. Please sign in again.");
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
      String(body).replace(/<[^>]*>/g, "").trim() +
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
    const u = findUser(p.email),
      password = String(p.password || "");
    if (u && u.status === "Pending")
      throw fail("Your account is awaiting Central Office approval.");
    if (u && u.status === "Rejected")
      throw fail(
        "Your account request was not approved. Contact Central Office for assistance.",
      );
    if (!u || u.password !== password)
      throw fail("Invalid credentials or inactive account.");
    const t = newToken();
    db.sessions.set(t, {
      email: u.email,
      name: u.name,
      role: u.role,
      region: u.region,
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
      name = text(p.name, 200),
      region = text(p.region, 80);
    if (!email || !name || REGIONS.indexOf(region) < 0)
      throw fail("Enter your name, official email and CHED Regional Office.");
    requireDomain(email);
    if (String(p.password || "").length < 12)
      throw fail("Use a password of at least 12 characters.");
    if (findUser(email))
      throw fail("An account request already exists for this email.");
    db.users.push({
      email,
      password: String(p.password),
      name,
      role: "chedro_user",
      region,
      status: "Pending",
    });
    return {
      message:
        "Account request submitted. Central Office will review your regional assignment before you can sign in.",
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
    u.status = approve ? "Approved" : "Rejected";
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
      initiatives: text(notes.initiatives, 5000),
      student: text(notes.student, 5000),
      academic: text(notes.academic, 5000),
      governance: text(notes.governance, 5000),
      regionConcerns: text(p.regionConcerns, 5000),
      otherMatters: text(p.otherMatters, 5000),
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
      presidedBy: text(p.presidedBy, 300),
      rapporteur: text(p.rapporteur, 300),
      certifiedBy: text(p.certifiedBy, 300),
      notedBy: text(p.notedBy, 300),
      submittedByEmail: u.email,
      submittedBy: u.name,
      submittedByRole: u.role,
      status: "For review",
      remarks: "",
    });
    return { submissionId: id, message: "Consultation report submitted." };
  },

  reviewSubmission(p) {
    session(p.accountToken, ["central_admin", "central_reviewer"]);
    const reference = text(p.reference, 60),
      status = text(p.status, 40),
      remarks = text(p.remarks, 2000);
    if (!reference) throw fail("Missing report reference.");
    if (STATUSES.indexOf(status) < 0) throw fail("Unsupported status.");
    if (status === "Needs revision" && !remarks)
      throw fail("Enter remarks explaining what the CHEDRO must revise.");
    const r = db.reports.find((x) => x.id === reference);
    if (!r) throw fail("Report " + reference + " was not found.");
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
        "Report marked " + status + "." + (notice.sent ? "" : " " + notice.warning),
    };
  },

  requestEmailOtp(p) {
    const email = asEmail(p.email);
    if (!email) throw fail("Enter a valid official email address.");
    requireDomain(email);
    const id = newToken(),
      code = String(Math.floor(100000 + Math.random() * 900000));
    db.otps.set(id, { email, code });
    mail(
      email,
      PORTAL_NAME + ": Password reset code",
      "Your verification code is " +
        code +
        ", valid for 10 minutes.\n    Do not share it. Ignore this email if you did not request a reset.",
    );
    return {
      otpRequestId: id,
      message: "Verification code sent to " + email + ".",
    };
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
    if (!u || u.status !== "Approved") throw fail("Approved account not found.");
    u.password = String(p.password);
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
            out = { ok: false, message: err.message || String(err) };
          }
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(out));
        });
      });
    },
  };
}
