import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  LayoutDashboard,
  FilePlus2,
  FileText,
  ShieldCheck,
  LogOut,
  Bell,
  Search,
  ChevronRight,
  Paperclip,
  Image,
  CheckCircle2,
  Send,
  Mail,
  LockKeyhole,
  Menu,
  X,
  Download,
  Eye,
  Clock3,
  CircleAlert,
  Building2,
  Users,
  CalendarDays,
  TrendingUp,
} from "lucide-react";
import "./styles.css";

const API_URL = import.meta.env.VITE_GAS_WEB_APP_URL || "";
const DOMAIN = import.meta.env.VITE_ALLOWED_EMAIL_DOMAIN || "ched.gov.ph";
async function api(payload) {
  if (!API_URL) throw new Error("Portal backend is not configured yet.");
  const r = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
  });
  const d = await r.json();
  if (!d.ok) throw new Error(d.message || "Request failed");
  return d;
}

const regions = [
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
const agenda = [
  [
    "initiatives",
    "CHED initiatives, programs and policies",
    "Initiatives, programs and policies that affect or are relevant to students",
  ],
  [
    "student",
    "Student welfare concerns",
    "Student concerns related to student welfare and services",
  ],
  [
    "academic",
    "Curriculum and academic programs",
    "Pressing matters of students related to curriculum or academic programs",
  ],
  [
    "governance",
    "HEI governance concerns",
    "Collective higher education institutional governance concerns affecting students",
  ],
];
const QUARTERS = [
  "1st Quarter",
  "2nd Quarter",
  "3rd Quarter",
  "4th Quarter",
];
const STATUSES = ["For review", "Validated", "Needs revision"];
const quarterNow = () => QUARTERS[Math.floor(new Date().getMonth() / 3)];
const yearNow = () => String(new Date().getFullYear());
/** Reporting year of a submission, read from the consultation date and
 * falling back to the submission timestamp. */
const yearOf = (r) => {
  const m =
    String(r.date || "").match(/(?:19|20)\d{2}/) ||
    String(r.timestamp || "").match(/(?:19|20)\d{2}/);
  return m ? m[0] : "";
};
/** Annex A sections in reporting order, used by the detail view and exports. */
const ANNEX_SECTIONS = [
  ["initiatives", "CHED initiatives, programs and policies"],
  ["student", "Student concerns related to student welfare and services"],
  ["academic", "Pressing matters related to curriculum or academic programs"],
  ["governance", "Collective HEI governance concerns affecting students"],
  ["regionConcerns", "Region-specific concerns"],
  ["otherMatters", "Other matters"],
];
const SIGNATORIES = [
  ["presidedBy", "Presided by"],
  ["rapporteur", "Rapporteur"],
  ["certifiedBy", "Certified correct by"],
  ["notedBy", "Noted by: CHED Regional Director"],
];
function App() {
  const [account, setAccount] = useState(() => {
      try {
        return JSON.parse(sessionStorage.getItem("chedro_account") || "null");
      } catch {
        return null;
      }
    }),
    [page, setPage] = useState("dashboard"),
    [adminTab, setAdminTab] = useState("summary"),
    [mobile, setMobile] = useState(false),
    [notifications, setNotifications] = useState(false);
  if (!account)
    return (
      <Login
        onLogin={(u) => {
          setAccount(u);
          sessionStorage.setItem("chedro_account", JSON.stringify(u));
          setPage(u.role.startsWith("central") ? "admin" : "dashboard");
        }}
      />
    );
  const admin = account.role.startsWith("central");
  const currentPage = admin ? "admin" : page;
  const navigate = (p) => {
    setPage(p);
    setMobile(false);
  };
  return (
    <div className="shell">
      <aside className={mobile ? "sidebar open" : "sidebar"}>
        <div className="brand">
          <img className="seal" src="/ched-logo.png" alt="CHED logo" />
          <div>
            <b>CHED Office of Student Development and Services</b>
            <small>Consultation Portal</small>
          </div>
          <button
            className="close"
            aria-label="Close navigation"
            onClick={() => setMobile(false)}
          >
            <X />
          </button>
        </div>
        <nav>
          {admin ? (
            <>
              <p className="nav-label">Administration</p>
              <Nav
                active={adminTab === "summary"}
                icon={<LayoutDashboard />}
                onClick={() => {
                  setAdminTab("summary");
                  navigate("admin");
                }}
              >
                National summary
              </Nav>
              <Nav
                active={adminTab === "submissions"}
                icon={<FileText />}
                onClick={() => {
                  setAdminTab("submissions");
                  navigate("admin");
                }}
              >
                Regional submissions
              </Nav>
              <Nav
                active={adminTab === "themes"}
                icon={<TrendingUp />}
                onClick={() => {
                  setAdminTab("themes");
                  navigate("admin");
                }}
              >
                Themes & actions
              </Nav>
              <Nav
                active={adminTab === "compliance"}
                icon={<ShieldCheck />}
                onClick={() => {
                  setAdminTab("compliance");
                  navigate("admin");
                }}
              >
                Compliance
              </Nav>
              <Nav
                active={adminTab === "users"}
                icon={<Users />}
                onClick={() => {
                  setAdminTab("users");
                  navigate("admin");
                }}
              >
                User access
              </Nav>
            </>
          ) : (
            <>
              <Nav
                active={page === "dashboard"}
                icon={<LayoutDashboard />}
                onClick={() => navigate("dashboard")}
              >
                Overview
              </Nav>
              <Nav
                active={page === "new"}
                icon={<FilePlus2 />}
                onClick={() => navigate("new")}
              >
                New report
              </Nav>
              <Nav
                active={page === "reports"}
                icon={<FileText />}
                onClick={() => navigate("reports")}
              >
                Regional submissions
              </Nav>
            </>
          )}
        </nav>
        <div className="profile">
          <div className="avatar">
            {account.name
              .split(" ")
              .map((x) => x[0])
              .slice(0, 2)
              .join("")}
          </div>
          <div>
            <b>{account.name}</b>
            <small>
              {admin ? "Central Office Administrator" : account.region}
            </small>
          </div>
          <button
            title="Sign out"
            onClick={() => {
              sessionStorage.removeItem("chedro_account");
              setAccount(null);
            }}
          >
            <LogOut />
          </button>
        </div>
      </aside>
      <main>
        <header>
          <button
            className="hamb"
            aria-label="Open navigation"
            onClick={() => setMobile(true)}
          >
            <Menu />
          </button>
          <div>
            <h1>
              {currentPage === "new"
                ? "New consultation report"
                : currentPage === "reports"
                  ? "Regional submissions"
                  : currentPage === "admin"
                    ? "CHEDRO submission summary"
                    : `Good morning, ${account.name.split(" ")[0]}`}
            </h1>
            <p>
              {currentPage === "new"
                ? "Annex A · Consultation and Dialogue Report"
                : currentPage === "admin"
                  ? "National view of regional consultation activity"
                  : `${account.region} reporting workspace`}
            </p>
          </div>
          <div className="head-actions">
            <span className="role-pill">
              {admin ? "Central Office" : account.region}
            </span>
            <button
              className="icon"
              aria-label="Notifications"
              aria-expanded={notifications}
              onClick={() => setNotifications(!notifications)}
            >
              <Bell />
            </button>
            {notifications && (
              <div className="notification-pop">
                <b>Notifications</b>
                <p>
                  {admin
                    ? "Review account requests and current-quarter submissions."
                    : `${quarterNow()} reporting is open.`}
                </p>
                <small>
                  {admin
                    ? "Open User access to review them."
                    : "Complete all Annex A sections before submission."}
                </small>
              </div>
            )}
          </div>
        </header>
        <section className="content">
          {currentPage === "dashboard" && (
            <Dashboard
              account={account}
              go={() => setPage("new")}
              viewReports={() => setPage("reports")}
            />
          )}{" "}
          {currentPage === "new" && (
            <ReportForm account={account} done={() => setPage("reports")} />
          )}{" "}
          {currentPage === "reports" && <Reports account={account} />}{" "}
          {currentPage === "admin" && (
            <Admin account={account} tab={adminTab} setTab={setAdminTab} />
          )}
        </section>
      </main>
    </div>
  );
}
function Login({ onLogin }) {
  const [mode, setMode] = useState("login"),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [name, setName] = useState(""),
    [region, setRegion] = useState(""),
    [requestId, setRequestId] = useState(""),
    [code, setCode] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState("");
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      if (mode === "register") {
        const d = await api({
          action: "registerAccount",
          email,
          password,
          name,
          region,
        });
        setSuccess(d.message || "Account request submitted for approval.");
        return;
      }
      const d = await api({ action: "accountLogin", email, password });
      onLogin({
        token: d.accountToken,
        email: d.email,
        name: d.displayName,
        role: d.role,
        region: d.region,
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function sendRecovery() {
    setBusy(true);
    setError("");
    try {
      const d = await api({ action: "requestEmailOtp", email });
      setRequestId(d.otpRequestId);
      setSuccess("A six-digit recovery code was sent to your official email.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function finishRecovery(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const v = await api({
        action: "verifyEmailOtp",
        otpRequestId: requestId,
        otpCode: code,
      });
      const d = await api({
        action: "resetPassword",
        otpSessionToken: v.otpSessionToken,
        password,
      });
      setSuccess(d.message);
      setRequestId("");
      setCode("");
      setPassword("");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const switchMode = (m) => {
    setMode(m);
    setError("");
    setSuccess("");
    setRequestId("");
    setCode("");
  };
  return (
    <div className="login-shell">
      <div className="login-brand">
        <img className="seal" src="/ched-logo.png" alt="CHED logo" />
        <div>
          <b>CHED Office of Student Development and Services</b>
          <small>Consultation & Dialogue Reporting Portal</small>
        </div>
      </div>
      <div className="login-grid">
        <section className="login-copy">
          <span className="eyebrow">
            Quarterly CHEDRO Consultation &amp; Dialogue
          </span>
          <h1>
            Student voices,
            <br />
            coordinated action.
          </h1>
          <p>
            The official OSDS workspace for CHED Regional Offices to document
            quarterly consultations, submit Annex A reports, and elevate student
            concerns for appropriate action.
          </p>
          <div className="login-points">
            <div>
              <ShieldCheck />
              <span>
                <b>Quarterly Annex A reporting</b>
                <small>
                  Record consultation details, agreements, attendance, and photo
                  documentation in one complete submission.
                </small>
              </span>
            </div>
            <div>
              <Building2 />
              <span>
                <b>Required consultation agenda</b>
                <small>
                  Cover CHED initiatives, student welfare, academic concerns,
                  HEI governance, and matters specific to your region.
                </small>
              </span>
            </div>
            <div>
              <LockKeyhole />
              <span>
                <b>OSDS consolidation and follow-through</b>
                <small>
                  Turn regional dialogue into a national summary of recurring
                  themes, commitments, and concerns requiring CHED action.
                </small>
              </span>
            </div>
          </div>
        </section>
        <section className="login-card">
          <div className="login-tabs">
            <button
              className={mode === "login" ? "active" : ""}
              onClick={() => switchMode("login")}
            >
              Sign in
            </button>
            <button
              className={mode === "register" ? "active" : ""}
              onClick={() => switchMode("register")}
            >
              Create account
            </button>
          </div>
          <h2>
            {mode === "login"
              ? "Welcome back"
              : mode === "register"
                ? "Request an account"
                : "Reset your password"}
          </h2>
          <p>
            {mode === "login"
              ? "Use your approved CHED account credentials."
              : mode === "register"
                ? "Choose your CHED Regional Office. Central Office will verify and approve your request."
                : "Verify your official email before choosing a new password."}
          </p>
          {mode === "recover" ? (
            <form onSubmit={finishRecovery}>
              <Field label="Official email" required>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={`name@${DOMAIN}`}
                />
              </Field>
              {requestId && (
                <>
                  <Field label="Recovery code" required>
                    <input
                      inputMode="numeric"
                      maxLength="6"
                      value={code}
                      onChange={(e) =>
                        setCode(e.target.value.replace(/\D/g, ""))
                      }
                      placeholder="000000"
                    />
                  </Field>
                  <Field label="New password" required>
                    <input
                      type="password"
                      minLength="12"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 12 characters"
                    />
                  </Field>
                </>
              )}
              {error && <p className="login-error">{error}</p>}
              {success && (
                <p className="login-success">
                  <CheckCircle2 />
                  {success}
                </p>
              )}
              {requestId ? (
                <button
                  className="login-submit"
                  disabled={busy || code.length !== 6 || password.length < 12}
                >
                  {busy ? "Please wait…" : "Update password"}
                </button>
              ) : (
                <button
                  type="button"
                  className="login-submit"
                  onClick={sendRecovery}
                  disabled={busy || !email}
                >
                  {busy ? "Please wait…" : "Send recovery code"}
                </button>
              )}
              <button
                type="button"
                className="forgot"
                onClick={() => switchMode("login")}
              >
                Back to sign in
              </button>
            </form>
          ) : (
            <>
              <form onSubmit={submit}>
                {mode === "register" && (
                  <>
                    <Field label="Full name" required>
                      <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Juan Dela Cruz"
                      />
                    </Field>
                    <Field label="CHED Regional Office" required>
                      <select
                        value={region}
                        onChange={(e) => setRegion(e.target.value)}
                      >
                        <option value="">Select your regional office</option>
                        {regions.map((r) => (
                          <option key={r}>{r}</option>
                        ))}
                      </select>
                    </Field>
                  </>
                )}
                <Field label="Official email" required>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={`name@${DOMAIN}`}
                  />
                </Field>
                <Field
                  label={mode === "login" ? "Password" : "Create password"}
                  required
                >
                  <input
                    type="password"
                    minLength="12"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={
                      mode === "login"
                        ? "Enter your password"
                        : "At least 12 characters"
                    }
                  />
                </Field>
                {error && <p className="login-error">{error}</p>}
                {success && (
                  <p className="login-success">
                    <CheckCircle2 />
                    {success}
                  </p>
                )}
                <button className="login-submit" disabled={busy || !!success}>
                  {busy
                    ? "Please wait…"
                    : mode === "login"
                      ? "Sign in securely"
                      : "Submit for approval"}
                </button>
              </form>
              {mode === "login" && (
                <button
                  className="forgot"
                  onClick={() => switchMode("recover")}
                >
                  Forgot password?
                </button>
              )}
            </>
          )}
        </section>
      </div>
      <footer>
        Official OSDS reporting portal · Authorized CHED personnel only · All
        access and changes are logged
      </footer>
    </div>
  );
}
function Nav({ active, icon, children, onClick }) {
  return (
    <button className={active ? "nav active" : "nav"} onClick={onClick}>
      {icon}
      <span>{children}</span>
      {active && <ChevronRight />}
    </button>
  );
}
function Dashboard({ go, account, viewReports }) {
  const [rows, setRows] = useState([]),
    [error, setError] = useState("");
  useEffect(() => {
    api({ action: "listRegionalSubmissions", accountToken: account.token })
      .then((d) => setRows(d.rows || []))
      .catch((e) => setError(e.message));
  }, [account.token]);
  const currentQuarter = quarterNow(),
    currentYear = yearNow(),
    // The quarterly timeline and current-quarter card cover this reporting
    // year only, so a prior year's report never marks this year as submitted.
    thisYearRows = rows.filter((r) => yearOf(r) === currentYear),
    currentReport = thisYearRows.find((r) => r.quarter === currentQuarter),
    validated = rows.filter((r) => r.status === "Validated").length,
    underReview = rows.filter((r) => r.status === "For review").length,
    participants = rows.reduce(
      (sum, r) => sum + Number(r.participants || 0),
      0,
    );
  return (
    <>
      <div className="hero">
        <div>
          <span className="eyebrow">
            {currentQuarter} · {new Date().getFullYear()}
          </span>
          <h2>
            Turn every dialogue into
            <br />
            visible action.
          </h2>
          <p>
            Capture regional consultations, agreements, attendance and
            documentation in one clear record.
          </p>
          <button className="primary" onClick={go}>
            <FilePlus2 />
            Create consultation report
          </button>
        </div>
        <div className="hero-card">
          <span>Current-quarter report</span>
          <b>{currentReport ? "Submitted" : "Pending"}</b>
          <div className="progress">
            <i style={{ width: currentReport ? "100%" : "0%" }} />
          </div>
          <p>
            {currentReport ? <CheckCircle2 /> : <Clock3 />} {currentQuarter}:{" "}
            {currentReport?.status || "No submission yet"}
          </p>
          <small>
            One consultation and dialogue report is required quarterly.
          </small>
        </div>
      </div>
      {error && <p className="notice error-notice">{error}</p>}
      <div className="stats">
        <Stat
          icon={<FileText />}
          n={String(rows.length)}
          label="Reports submitted"
          tone="blue"
        />
        <Stat
          icon={<CheckCircle2 />}
          n={String(validated)}
          label="Validated"
          tone="green"
        />
        <Stat
          icon={<Clock3 />}
          n={String(underReview)}
          label="Under review"
          tone="amber"
        />
        <Stat
          icon={<Users />}
          n={participants.toLocaleString()}
          label="Participants reached"
          tone="purple"
        />
      </div>
      <div className="grid-two">
        <div className="panel">
          <div className="panel-head">
            <div>
              <h3>Recent submissions</h3>
              <p>Your latest consultation reports</p>
            </div>
            <button onClick={viewReports}>View all</button>
          </div>
          <ReportTable rows={rows.slice(0, 3)} />
        </div>
        <div className="panel timeline">
          <div className="panel-head">
            <div>
              <h3>Quarterly timeline</h3>
              <p>Reporting year {currentYear}</p>
            </div>
          </div>
          {QUARTERS.map((quarter, i) => {
            const report = thisYearRows.find((r) => r.quarter === quarter);
            return (
              <div className={report ? "mile done" : "mile"} key={quarter}>
                <i>{report ? <CheckCircle2 /> : i + 1}</i>
                <div>
                  <b>{quarter}</b>
                  <small>
                    {report ? report.status : "No submission recorded"}
                  </small>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
function Stat({ icon, n, label, tone }) {
  return (
    <div className="stat">
      <span className={tone}>{icon}</span>
      <div>
        <b>{n}</b>
        <small>{label}</small>
      </div>
    </div>
  );
}

function ReportForm({ done, account }) {
  const [step, setStep] = useState(1),
    [msg, setMsg] = useState(""),
    [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    region: account.region,
    quarter: quarterNow(),
    date: "",
    regionConcerns: "",
    otherMatters: "",
    presidedBy: "",
    rapporteur: "",
    certifiedBy: "",
    notedBy: "",
    participants: "",
    attendanceFile: null,
    photoFiles: [],
    notes: { initiatives: "", student: "", academic: "", governance: "" },
  });
  const update = (k, v) => setForm((f) => ({ ...f, [k]: v })),
    note = (k, v) => setForm((f) => ({ ...f, notes: { ...f.notes, [k]: v } }));
  function validate(target) {
    if (target >= 2 && !form.date)
      return "Enter the consultation or dialogue date.";
    if (target >= 3) {
      const missing = agenda
        .filter(([k]) => !form.notes[k].trim())
        .map(([, t]) => t);
      if (missing.length)
        return `Complete all agenda discussions: ${missing.join(", ")}.`;
      if (!form.regionConcerns.trim())
        return "Enter the region-specific concerns.";
      if (!form.otherMatters.trim())
        return "Enter other matters discussed, or state “None”.";
      if (!form.attendanceFile) return "Attach the attendance sheet.";
      if (!form.photoFiles.length)
        return "Attach at least one consultation photo.";
    }
    return "";
  }
  async function encodeFile(file) {
    if (!file) return null;
    if (file.size > 5 * 1024 * 1024)
      throw new Error(`${file.name} exceeds the 5 MB limit.`);
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () =>
        resolve({
          name: file.name,
          type: file.type || "application/octet-stream",
          data: String(reader.result).split(",")[1],
        });
      reader.onerror = () => reject(new Error(`Unable to read ${file.name}.`));
      reader.readAsDataURL(file);
    });
  }
  async function chooseAttendance(e) {
    try {
      setMsg("");
      update("attendanceFile", await encodeFile(e.target.files?.[0]));
    } catch (err) {
      e.target.value = "";
      setMsg(err.message);
    }
  }
  async function choosePhotos(e) {
    try {
      setMsg("");
      const files = Array.from(e.target.files || []);
      if (files.length > 5) throw new Error("Attach no more than 5 photos.");
      update("photoFiles", await Promise.all(files.map(encodeFile)));
    } catch (err) {
      e.target.value = "";
      setMsg(err.message);
    }
  }
  function moveTo(target) {
    if (target <= step) {
      setMsg("");
      setStep(target);
      return;
    }
    const error = validate(target);
    if (error) {
      setMsg(error);
      return;
    }
    setMsg("");
    setStep(target);
  }
  async function submit(e) {
    e.preventDefault();
    const error = validate(3);
    if (error) {
      setMsg(error);
      return;
    }
    setBusy(true);
    try {
      await api({
        action: "submitDialogue",
        accountToken: account.token,
        ...form,
      });
      done();
    } catch (e) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="form-wrap" onSubmit={submit}>
      <div className="stepper">
        {["Report details", "Consultation record", "Review & submit"].map(
          (s, i) => (
            <button
              type="button"
              onClick={() => moveTo(i + 1)}
              className={step === i + 1 ? "on" : step > i + 1 ? "done" : ""}
              key={s}
            >
              <i>{step > i + 1 ? <CheckCircle2 /> : i + 1}</i>
              <span>{s}</span>
            </button>
          ),
        )}
      </div>
      {step === 1 && (
        <div className="form-card">
          <FormTitle
            n="01"
            title="Report details"
            text="Identify the reporting period and consultation."
          />
          <div className="region-lock">
            <LockKeyhole />
            <div>
              <small>CHED Regional Office</small>
              <b>{account.region}</b>
              <p>
                Assigned from your approved account and cannot be changed per
                report.
              </p>
            </div>
          </div>
          <div className="fields two">
            <Field label="Quarter" required>
              <select
                value={form.quarter}
                onChange={(e) => update("quarter", e.target.value)}
              >
                {QUARTERS.map((q) => (
                  <option key={q}>{q}</option>
                ))}
              </select>
            </Field>
            <Field label="Date of consultation/dialogue" required>
              <input
                type="date"
                value={form.date}
                onChange={(e) => update("date", e.target.value)}
              />
            </Field>
          </div>
          <Field label="Total participants">
            <input
              type="number"
              min="0"
              placeholder="e.g. 84"
              value={form.participants}
              onChange={(e) => update("participants", e.target.value)}
            />
          </Field>
          {msg && <p className="notice error-notice">{msg}</p>}
          <div className="form-actions">
            <span />
            <button type="button" className="primary" onClick={() => moveTo(2)}>
              Continue <ChevronRight />
            </button>
          </div>
        </div>
      )}
      {step === 2 && (
        <div className="form-card">
          <FormTitle
            n="02"
            title="Consultation record"
            text="Record key details, agreements and supporting evidence."
          />
          <h4 className="section-label">Agenda discussions</h4>
          {agenda.map(([k, t, d]) => (
            <div className="agenda" key={k}>
              <div>
                <b>
                  {t} <em>*</em>
                </b>
                <p>{d}</p>
              </div>
              <textarea
                required
                rows="3"
                value={form.notes[k]}
                onChange={(e) => note(k, e.target.value)}
                placeholder="Cite key points, decisions or agreements made…"
              />
            </div>
          ))}
          <div className="fields two">
            <Field label="Region-specific concerns" required>
              <textarea
                rows="4"
                value={form.regionConcerns}
                onChange={(e) => update("regionConcerns", e.target.value)}
                placeholder="Describe concerns unique to your region…"
              />
            </Field>
            <Field label="Other matters" required>
              <textarea
                rows="4"
                value={form.otherMatters}
                onChange={(e) => update("otherMatters", e.target.value)}
                placeholder="Record any additional matters discussed, or state None…"
              />
            </Field>
          </div>
          <h4 className="section-label">Supporting documents</h4>
          <div className="uploads">
            <Upload
              icon={<Paperclip />}
              title="Attendance sheet"
              selected={form.attendanceFile?.name}
              accept=".pdf,.doc,.docx,.xls,.xlsx"
              required
              onChange={chooseAttendance}
            />
            <Upload
              icon={<Image />}
              title="Photo documentation"
              selected={form.photoFiles.map((f) => f.name).join(", ")}
              accept="image/*"
              multiple
              required
              onChange={choosePhotos}
            />
          </div>
          {msg && <p className="notice error-notice">{msg}</p>}
          <div className="form-actions">
            <button
              type="button"
              className="secondary"
              onClick={() => moveTo(1)}
            >
              Back
            </button>
            <button type="button" className="primary" onClick={() => moveTo(3)}>
              Continue <ChevronRight />
            </button>
          </div>
        </div>
      )}
      {step === 3 && (
        <div className="form-card">
          <FormTitle
            n="03"
            title="Certification & submission"
            text="Confirm the accountable user and complete signatories."
          />
          <div className="verify-box account-box">
            <div className="verify-icon">
              <CheckCircle2 />
            </div>
            <div className="verify-main">
              <b>Submitting as {account.name}</b>
              <p>
                {account.email} · {account.region} · CHEDRO User
              </p>
              <small>
                This report will be added to your regional history and recorded
                under your account.
              </small>
            </div>
          </div>
          {msg && <p className="notice">{msg}</p>}
          <div className="fields two">
            <Field label="Presided by" required>
              <input
                value={form.presidedBy}
                onChange={(e) => update("presidedBy", e.target.value)}
                placeholder="Full name and designation"
              />
            </Field>
            <Field label="Rapporteur" required>
              <input
                value={form.rapporteur}
                onChange={(e) => update("rapporteur", e.target.value)}
                placeholder="Full name and designation"
              />
            </Field>
            <Field label="Certified correct by" required>
              <input
                value={form.certifiedBy}
                onChange={(e) => update("certifiedBy", e.target.value)}
                placeholder="Full name and designation"
              />
            </Field>
            <Field label="Noted by: CHED Regional Director" required>
              <input
                value={form.notedBy}
                onChange={(e) => update("notedBy", e.target.value)}
                placeholder="Regional Director’s name"
              />
            </Field>
          </div>
          <label className="cert">
            <input type="checkbox" required />
            <span>
              I certify that this report faithfully reflects the consultation
              and dialogue conducted by the CHED Regional Office, including all
              agreements and supporting records.
            </span>
          </label>
          <div className="form-actions">
            <button
              type="button"
              className="secondary"
              onClick={() => setStep(2)}
            >
              Back
            </button>
            <button className="primary" disabled={busy}>
              <Send />
              {busy ? "Submitting…" : "Submit report"}
            </button>
          </div>
        </div>
      )}
    </form>
  );
}
function FormTitle({ n, title, text }) {
  return (
    <div className="form-title">
      <span>{n}</span>
      <div>
        <h3>{title}</h3>
        <p>{text}</p>
      </div>
    </div>
  );
}
function Field({ label, required, children }) {
  return (
    <label className="field">
      <span>
        {label}
        {required && <em>*</em>}
      </span>
      {React.cloneElement(children, {
        required: required || children.props.required,
      })}
    </label>
  );
}
function Upload({ icon, title, selected, ...props }) {
  return (
    <label className="upload">
      {icon}
      <b>{title}</b>
      <span>
        {selected || (
          <>
            Drag and drop or <u>browse files</u>
          </>
        )}
      </span>
      <small>Maximum 5 MB per file · Up to 5 photos</small>
      <input aria-label={title} type="file" {...props} />
    </label>
  );
}
// U+FEFF byte-order mark, so Excel opens the export as UTF-8.
const BOM = String.fromCharCode(0xfeff);
const CSV_COLUMNS = [
  ["id", "Reference"],
  ["region", "CHED Regional Office"],
  ["quarter", "Quarter"],
  ["date", "Date of consultation and dialogue"],
  ["participants", "Total participants"],
  ["initiatives", "CHED initiatives, programs and policies"],
  ["student", "Student welfare and services"],
  ["academic", "Curriculum and academic programs"],
  ["governance", "HEI governance concerns"],
  ["regionConcerns", "Region-specific concerns"],
  ["otherMatters", "Other matters"],
  ["attendanceFile", "Attendance sheet"],
  ["photoFiles", "Photo documentation"],
  ["presidedBy", "Presided by"],
  ["rapporteur", "Rapporteur"],
  ["certifiedBy", "Certified correct by"],
  ["notedBy", "Noted by: CHED Regional Director"],
  ["submittedBy", "Submitted by"],
  ["status", "Status"],
  ["remarks", "Central Office remarks"],
];
/** Export every Annex A field the caller actually holds, so a consolidated
 * file carries the narrative and not only the reference numbers. */
function downloadCsv(rows, name = "chedro-dialogue-reports.csv") {
  const present = CSV_COLUMNS.filter(([k]) =>
      rows.some((r) => String(r[k] ?? "") !== ""),
    ),
    cols = present.length ? present : CSV_COLUMNS.slice(0, 5),
    // Reports carry free text written by regional users. Excel evaluates a
    // field that starts with = + - @ (or a leading tab/CR) as a formula even
    // when it is quoted, so prefix those with an apostrophe to keep them text.
    cell = (v) => {
      const text = String(v ?? "")
        .replaceAll('"', '""')
        .replace(/\r?\n/g, " · ");
      return `"${/^[=+\-@\t\r]/.test(text) ? "'" + text : text}"`;
    };
  const csv = [
    cols.map(([, label]) => cell(label)).join(","),
    ...rows.map((r) => cols.map(([k]) => cell(r[k])).join(",")),
  ].join("\r\n");
  const url = URL.createObjectURL(
      new Blob([BOM + csv], { type: "text/csv;charset=utf-8" }),
    ),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
function Reports({ account }) {
  const [rows, setRows] = useState([]),
    [error, setError] = useState(""),
    [query, setQuery] = useState(""),
    [quarter, setQuarter] = useState("All quarters"),
    [year, setYear] = useState("All years"),
    [status, setStatus] = useState("All statuses");
  useEffect(() => {
    api({ action: "listRegionalSubmissions", accountToken: account.token })
      .then((d) => setRows(d.rows || []))
      .catch((e) => setError(e.message));
  }, [account.token]);
  const years = Array.from(
      new Set(rows.map(yearOf).filter(Boolean).concat(yearNow())),
    ).sort((a, b) => b.localeCompare(a)),
    needsRevision = rows.filter((r) => r.status === "Needs revision").length,
    queryText = query.trim().toLowerCase(),
    filtered = rows.filter(
      (r) =>
        (status === "All statuses" || r.status === status) &&
        (quarter === "All quarters" || r.quarter === quarter) &&
        (year === "All years" || yearOf(r) === year) &&
        (!queryText ||
          [r.id, r.region, r.quarter, r.date, r.status, r.remarks]
            .join(" ")
            .toLowerCase()
            .includes(queryText)),
    );
  return (
    <>
      <div className="history-banner">
        <Building2 />
        <div>
          <b>{account.region} submission history</b>
          <p>
            Reports submitted by any authorized user in your regional office
            appear here.
          </p>
        </div>
        <span>{rows.length} active reports</span>
      </div>
      {error && <p className="notice error-notice">{error}</p>}
      {needsRevision > 0 && (
        <p className="notice error-notice">
          {needsRevision} report{needsRevision > 1 ? "s" : ""} returned by the
          Central Office for revision. Open the report to read the remarks.
        </p>
      )}
      <div className="panel reports">
        <div className="toolbar">
          <div className="search">
            <Search />
            <input
              aria-label="Search reports"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search reports, reference or remarks…"
            />
          </div>
          <select
            aria-label="Filter by quarter"
            className={quarter === "All quarters" ? "" : "filter-on"}
            value={quarter}
            onChange={(e) => setQuarter(e.target.value)}
          >
            <option>All quarters</option>
            {QUARTERS.map((q) => (
              <option key={q}>{q}</option>
            ))}
          </select>
          <select
            aria-label="Filter by reporting year"
            className={year === "All years" ? "" : "filter-on"}
            value={year}
            onChange={(e) => setYear(e.target.value)}
          >
            <option>All years</option>
            {years.map((y) => (
              <option key={y}>{y}</option>
            ))}
          </select>
          <select
            aria-label="Filter by status"
            className={status === "All statuses" ? "" : "filter-on"}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option>All statuses</option>
            {STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <button onClick={() => downloadCsv(filtered)}>
            <Download />
            Export
          </button>
        </div>
        <ReportTable
          rows={filtered}
          emptyText="No reports match these filters."
        />
      </div>
    </>
  );
}
/** Shared submissions table. `onReview` is supplied by Central Office screens
 * and turns each expanded row into a validation panel. */
function ReportTable({ rows, onReview, emptyText = "No reports to show." }) {
  const [open, setOpen] = useState("");
  if (!rows.length) return <p className="empty-state">{emptyText}</p>;
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Reference</th>
            <th>Regional office</th>
            <th>Period</th>
            <th>Consultation</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <React.Fragment key={r.id}>
              <tr>
                <td>
                  <b>{r.id}</b>
                </td>
                <td>{r.region}</td>
                <td>
                  {r.quarter}
                  {yearOf(r) && ` · ${yearOf(r)}`}
                </td>
                <td>{r.date}</td>
                <td>
                  <Status s={r.status} />
                </td>
                <td>
                  <button
                    className="view"
                    aria-label={`${open === r.id ? "Close" : "View"} report ${r.id}`}
                    onClick={() => setOpen(open === r.id ? "" : r.id)}
                  >
                    <Eye />
                  </button>
                </td>
              </tr>
              {open === r.id && (
                <tr className="report-detail">
                  <td colSpan="6">
                    <ReportDetail report={r} onReview={onReview} />
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
/** Full Annex A record. Fields the caller did not load are simply omitted, so
 * this renders for both the regional summary list and the Central Office view. */
function ReportDetail({ report, onReview }) {
  const sections = ANNEX_SECTIONS.filter(([k]) => report[k]),
    signatories = SIGNATORIES.filter(([k]) => report[k]),
    photos = String(report.photoFiles || "")
      .split("\n")
      .filter(Boolean);
  return (
    <div className="annex-detail" id={`annex-${report.id}`}>
      <div className="annex-head">
        <div>
          <b>
            {report.id} · {report.region}
          </b>
          <p>
            Consultation and Dialogue Report · {report.quarter}
            {yearOf(report) && ` ${yearOf(report)}`} · held {report.date}
          </p>
          {report.submittedBy && (
            <small>
              Submitted by {report.submittedBy}
              {report.participants
                ? ` · ${Number(report.participants).toLocaleString()} participants`
                : ""}
            </small>
          )}
        </div>
        <Status s={report.status} />
      </div>
      {report.remarks && (
        <p className="annex-remarks">
          <CircleAlert />
          <span>
            <b>Central Office remarks:</b> {report.remarks}
          </span>
        </p>
      )}
      {sections.length > 0 && (
        <dl className="annex-sections">
          {sections.map(([k, label]) => (
            <div key={k}>
              <dt>{label}</dt>
              <dd>{report[k]}</dd>
            </div>
          ))}
        </dl>
      )}
      {(report.attendanceFile || photos.length > 0) && (
        <div className="annex-files">
          {report.attendanceFile && (
            <a
              href={report.attendanceFile}
              target="_blank"
              rel="noreferrer noopener"
            >
              <Paperclip />
              Attendance sheet
            </a>
          )}
          {photos.map((url, i) => (
            <a key={url} href={url} target="_blank" rel="noreferrer noopener">
              <Image />
              Photo {i + 1}
            </a>
          ))}
        </div>
      )}
      {signatories.length > 0 && (
        <div className="annex-signatories">
          {signatories.map(([k, label]) => (
            <div key={k}>
              <small>{label}</small>
              <b>{report[k]}</b>
            </div>
          ))}
        </div>
      )}
      {onReview && <ReviewActions report={report} onReview={onReview} />}
    </div>
  );
}
/** Central Office validation controls for one submission. */
function ReviewActions({ report, onReview }) {
  const [remarks, setRemarks] = useState(report.remarks || ""),
    [edited, setEdited] = useState(false),
    [busy, setBusy] = useState(""),
    [message, setMessage] = useState(""),
    [messageWarn, setMessageWarn] = useState(false);
  // Re-seed from the stored record whenever the row is decided elsewhere.
  useEffect(() => {
    setRemarks(report.remarks || "");
    setEdited(false);
  }, [report.id, report.remarks]);
  async function decide(status) {
    // Remarks belong to the decision that produced them: a stored "needs
    // revision" note must not follow the report into validation and get
    // emailed back as if the office still had something to fix.
    const outgoing = status === "Validated" && !edited ? "" : remarks;
    setBusy(status);
    setMessage("");
    setMessageWarn(false);
    try {
      const d = await onReview(report.id, status, outgoing);
      setRemarks(outgoing);
      setEdited(false);
      setMessage(d?.message || `Marked ${status}.`);
      setMessageWarn(d?.notified === false);
    } catch (e) {
      setMessage(e.message);
      setMessageWarn(true);
    } finally {
      setBusy("");
    }
  }
  return (
    <div className="review-actions">
      <label className="field">
        <span>Remarks to the regional office</span>
        <textarea
          rows="2"
          value={remarks}
          onChange={(e) => {
            setRemarks(e.target.value);
            setEdited(true);
          }}
          placeholder="Required when returning a report for revision…"
        />
      </label>
      <div className="review-buttons">
        <button
          type="button"
          className="primary"
          disabled={!!busy || report.status === "Validated"}
          onClick={() => decide("Validated")}
        >
          <CheckCircle2 />
          {busy === "Validated" ? "Saving…" : "Validate"}
        </button>
        <button
          type="button"
          className="secondary"
          disabled={!!busy}
          onClick={() => decide("Needs revision")}
        >
          <CircleAlert />
          {busy === "Needs revision" ? "Saving…" : "Return for revision"}
        </button>
        <button
          type="button"
          className="secondary"
          disabled={!!busy || report.status === "For review"}
          onClick={() => decide("For review")}
        >
          <Clock3 />
          Reset to for review
        </button>
      </div>
      {message && (
        <p className={messageWarn ? "notice error-notice" : "notice"}>
          {message}
        </p>
      )}
    </div>
  );
}
function Status({ s }) {
  const label = String(s || "").trim() || "For review";
  return (
    <span className={"status " + label.toLowerCase().replaceAll(" ", "-")}>
      {label}
    </span>
  );
}
function Admin({ tab, setTab, account }) {
  const [live, setLive] = useState(null),
    [loadError, setLoadError] = useState("");
  // Reporting period drives the national panels; the submission filters below
  // narrow the queue down to one CHEDRO, status or search term.
  const [period, setPeriod] = useState({
      quarter: quarterNow(),
      year: yearNow(),
    }),
    [filters, setFilters] = useState({
      region: "All CHEDROs",
      status: "All statuses",
      query: "",
    });
  useEffect(() => {
    api({ action: "adminDashboard", accountToken: account.token })
      .then(setLive)
      .catch((e) => setLoadError(e.message));
  }, [account.token]);
  const adminRows = live?.rows || [];
  async function review(reference, status, remarks) {
    const d = await api({
      action: "reviewSubmission",
      accountToken: account.token,
      reference,
      status,
      remarks,
    });
    setLive((prev) => ({
      ...prev,
      rows: (prev?.rows || []).map((r) =>
        r.id === reference ? { ...r, status, remarks } : r,
      ),
    }));
    return d;
  }
  const setPeriodField = (k, v) => setPeriod((p) => ({ ...p, [k]: v })),
    setFilter = (k, v) => setFilters((f) => ({ ...f, [k]: v }));
  const years = Array.from(
      new Set(adminRows.map(yearOf).filter(Boolean).concat(yearNow())),
    ).sort((a, b) => b.localeCompare(a)),
    total = regions.length,
    // National panels: scoped to the reporting period only, so coverage and
    // pending-office counts stay meaningful regardless of the region filter.
    periodRows = adminRows.filter(
      (r) =>
        (period.quarter === "All quarters" || r.quarter === period.quarter) &&
        (period.year === "All years" || yearOf(r) === period.year),
    ),
    periodLabel = `${period.quarter === "All quarters" ? "All quarters" : period.quarter}${
      period.year === "All years" ? "" : ` · ${period.year}`
    }`,
    // Submission queue: the period rows narrowed by CHEDRO, status and search.
    queryText = filters.query.trim().toLowerCase(),
    filteredRows = periodRows.filter(
      (r) =>
        (filters.region === "All CHEDROs" || r.region === filters.region) &&
        (filters.status === "All statuses" || r.status === filters.status) &&
        (!queryText ||
          [
            r.id,
            r.region,
            r.quarter,
            r.date,
            r.status,
            r.submittedBy,
            r.initiatives,
            r.student,
            r.academic,
            r.governance,
            r.regionConcerns,
            r.otherMatters,
          ]
            .join(" ")
            .toLowerCase()
            .includes(queryText)),
    ),
    filtersActive =
      filters.region !== "All CHEDROs" ||
      filters.status !== "All statuses" ||
      !!queryText,
    submittedRegions = new Set(periodRows.map((r) => r.region)),
    submitted = submittedRegions.size,
    coverage = Math.round((submitted / total) * 100),
    participants = periodRows.reduce(
      (sum, row) => sum + Number(row.participants || 0),
      0,
    ),
    themes = {
      initiatives: periodRows.filter((r) => r.initiatives).length,
      student: periodRows.filter((r) => r.student).length,
      academic: periodRows.filter((r) => r.academic).length,
      governance: periodRows.filter((r) => r.governance).length,
      regionSpecific: periodRows.filter((r) => r.regionConcerns).length,
    },
    concerns = Object.values(themes).reduce((a, b) => a + Number(b || 0), 0),
    validated = periodRows.filter((r) => r.status === "Validated").length,
    attendanceCount = periodRows.filter((r) => r.attendanceFile).length,
    photoCount = periodRows.filter((r) => r.photoFiles).length,
    agendaComplete = periodRows.filter(
      (r) => r.initiatives && r.student && r.academic && r.governance,
    ).length,
    signatoriesComplete = periodRows.filter(
      (r) => r.presidedBy && r.rapporteur && r.certifiedBy && r.notedBy,
    ).length,
    completeReports = periodRows.filter(
      (r) =>
        r.date &&
        r.initiatives &&
        r.student &&
        r.academic &&
        r.governance &&
        r.attendanceFile &&
        r.photoFiles &&
        r.presidedBy &&
        r.rapporteur &&
        r.certifiedBy &&
        r.notedBy,
    ).length,
    dateCount = periodRows.filter((r) => r.date && r.quarter).length,
    followUps = periodRows.filter((r) => r.status === "Needs revision").length,
    rate = (value) =>
      periodRows.length ? Math.round((value / periodRows.length) * 100) : 0,
    // A period with no submissions is neither passing nor failing: without
    // this guard "0 of 0" satisfies every check and the tab reads all-green.
    check = (n) => ({
      value: `${n}/${periodRows.length}`,
      ok: periodRows.length > 0 && n === periodRows.length,
      warn: periodRows.length > 0 && n !== periodRows.length,
    }),
    regionStatus = (region) => {
      const reports = periodRows.filter((r) => r.region === region);
      if (!reports.length) return "Pending";
      if (reports.some((r) => r.status === "Needs revision"))
        return "Needs revision";
      if (reports.some((r) => r.status === "For review")) return "For review";
      return reports[0].status || "Submitted";
    };
  const themeRanking = [
      ["Student welfare concerns", themes.student],
      ["Curriculum and academic programs", themes.academic],
      ["CHED initiatives and policies", themes.initiatives],
      ["Region-specific concerns", themes.regionSpecific],
      ["HEI governance concerns", themes.governance],
    ].sort((a, b) => b[1] - a[1]),
    regionalSignals = periodRows.filter((r) => r.regionConcerns).slice(0, 3);
  return (
    <>
      <div className="admin-top">
        <div className="period">
          <CalendarDays />
          <div>
            <small>Reporting period</small>
            <div className="period-selects">
              <select
                aria-label="Quarter"
                value={period.quarter}
                onChange={(e) => setPeriodField("quarter", e.target.value)}
              >
                <option>All quarters</option>
                {QUARTERS.map((q) => (
                  <option key={q}>{q}</option>
                ))}
              </select>
              <select
                aria-label="Reporting year"
                value={period.year}
                onChange={(e) => setPeriodField("year", e.target.value)}
              >
                <option>All years</option>
                {years.map((y) => (
                  <option key={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <button
          className="primary"
          onClick={() =>
            downloadCsv(
              filtersActive ? filteredRows : periodRows,
              `chedro-consolidated-report-${(filtersActive ? filters.region : "all-chedros")
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")}.csv`,
            )
          }
        >
          <Download />
          Export {filtersActive ? "filtered" : "consolidated"} report
        </button>
      </div>
      {loadError && <p className="notice error-notice">{loadError}</p>}
      <div className="admin-tabs">
        {[
          ["summary", "National summary"],
          ["submissions", "Submissions"],
          ["themes", "Themes & actions"],
          ["compliance", "Compliance"],
          ["users", "User access"],
        ].map(([k, v]) => (
          <button
            key={k}
            className={tab === k ? "active" : ""}
            onClick={() => setTab(k)}
          >
            {v}
          </button>
        ))}
      </div>
      {tab === "summary" && (
        <>
          <div className="stats admin-stats">
            <Stat
              icon={<Building2 />}
              n={`${submitted}/${total}`}
              label="CHEDROs submitted"
              tone="blue"
            />
            <Stat
              icon={<Users />}
              n={participants.toLocaleString()}
              label="Participants reached"
              tone="purple"
            />
            <Stat
              icon={<FileText />}
              n={String(concerns)}
              label="Concern sections completed"
              tone="amber"
            />
            <Stat
              icon={<CheckCircle2 />}
              n={String(validated)}
              label="Reports validated"
              tone="green"
            />
          </div>
          <div className="summary-grid">
            <div className="panel">
              <div className="panel-head">
                <div>
                  <h3>National submission coverage</h3>
                  <p>
                    {submitted} of {total} CHED Regional Offices · NIR included
                  </p>
                </div>
                <b className="coverage">{coverage}%</b>
              </div>
              <div className="big-progress">
                <i style={{ width: coverage + "%" }} />
              </div>
              <div className="region-grid">
                {regions.map((r) => {
                  const status = regionStatus(r);
                  const sent = status !== "Pending";
                  const count = periodRows.filter(
                    (row) => row.region === r,
                  ).length;
                  return (
                    <button
                      type="button"
                      className={sent ? "region sent" : "region"}
                      key={r}
                      title={`Open ${r} submissions for ${periodLabel}`}
                      onClick={() => {
                        setFilter("region", r);
                        setTab("submissions");
                      }}
                    >
                      <i>{sent ? <CheckCircle2 /> : <Clock3 />}</i>
                      <span>{r}</span>
                      <small>
                        {status}
                        {count > 1 ? ` · ${count} reports` : ""}
                      </small>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="panel insights">
              <div className="panel-head">
                <div>
                  <h3>Executive synthesis</h3>
                  <p>What Central Office should know</p>
                </div>
                <span className="ai">LIVE SUMMARY</span>
              </div>
              <div className="insight">
                <i>1</i>
                <div>
                  <b>Student welfare is the most frequently documented area</b>
                  <p>
                    {themes.student} submitted reports contain student welfare
                    concerns requiring review or follow-through.
                  </p>
                </div>
              </div>
              <div className="insight">
                <i>2</i>
                <div>
                  <b>Academic and policy matters remain significant</b>
                  <p>
                    {themes.academic} reports discuss curriculum or academic
                    programs, while {themes.initiatives} discuss CHED
                    initiatives and policies.
                  </p>
                </div>
              </div>
              <div className="insight">
                <i>3</i>
                <div>
                  <b>{total - submitted} CHEDROs remain outstanding</b>
                  <p>
                    NIR is included in the {total}-office national baseline for
                    submission monitoring.
                  </p>
                </div>
              </div>
              <button className="text-btn" onClick={() => setTab("themes")}>
                Open thematic analysis <ChevronRight />
              </button>
            </div>
          </div>
          <div className="metric-grid">
            <MiniMetric
              label="Validation rate"
              value={`${rate(validated)}%`}
              detail={`${validated} of ${periodRows.length} reports validated`}
              trend={`${periodRows.length - validated} awaiting completion or review`}
            />
            <MiniMetric
              label="Report completeness"
              value={`${rate(completeReports)}%`}
              detail={`${completeReports} of ${periodRows.length} reports complete`}
              trend="Required evidence and signatories"
            />
            <MiniMetric
              label="Average participants"
              value={String(
                periodRows.length
                  ? Math.round(participants / periodRows.length)
                  : 0,
              )}
              detail="Per regional consultation"
              trend={`${participants.toLocaleString()} participants total`}
            />
            <MiniMetric
              label="Outstanding offices"
              value={String(total - submitted)}
              detail={`${submitted} of ${total} CHEDROs submitted`}
              trend={`${coverage}% national coverage`}
            />
          </div>
        </>
      )}
      {tab === "submissions" && (
        <>
          <div className="stats admin-stats">
            <Stat
              icon={<FileText />}
              n={String(filteredRows.length)}
              label="Received"
              tone="blue"
            />
            <Stat
              icon={<CheckCircle2 />}
              n={String(
                filteredRows.filter((r) => r.status === "Validated").length,
              )}
              label="Validated"
              tone="green"
            />
            <Stat
              icon={<Clock3 />}
              n={String(
                filteredRows.filter((r) => r.status === "For review").length,
              )}
              label="For review"
              tone="amber"
            />
            <Stat
              icon={<CircleAlert />}
              n={String(
                filteredRows.filter((r) => r.status === "Needs revision")
                  .length,
              )}
              label="Needs revision"
              tone="purple"
            />
          </div>
          <div className="panel reports">
            <div className="panel-head">
              <div>
                <h3>
                  {filters.region === "All CHEDROs"
                    ? "Regional submissions"
                    : `${filters.region} submissions`}
                </h3>
                <p>
                  {periodLabel} · review, validate and follow up with reporting
                  offices
                </p>
              </div>
              <div className="legend">
                <i className="green-dot" />
                Validated <i className="amber-dot" />
                For review
              </div>
            </div>
            <div className="toolbar">
              <div className="search">
                <Search />
                <input
                  aria-label="Search submissions"
                  value={filters.query}
                  onChange={(e) => setFilter("query", e.target.value)}
                  placeholder="Search reference, office or reported concern…"
                />
              </div>
              <select
                aria-label="Filter by CHED Regional Office"
                className={
                  filters.region === "All CHEDROs" ? "" : "filter-on"
                }
                value={filters.region}
                onChange={(e) => setFilter("region", e.target.value)}
              >
                <option>All CHEDROs</option>
                {regions.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
              <select
                aria-label="Filter by status"
                className={
                  filters.status === "All statuses" ? "" : "filter-on"
                }
                value={filters.status}
                onChange={(e) => setFilter("status", e.target.value)}
              >
                <option>All statuses</option>
                {STATUSES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
              {filtersActive && (
                <button
                  onClick={() =>
                    setFilters({
                      region: "All CHEDROs",
                      status: "All statuses",
                      query: "",
                    })
                  }
                >
                  <X />
                  Clear
                </button>
              )}
              <button onClick={() => downloadCsv(filteredRows)}>
                <Download />
                Export
              </button>
            </div>
            <ReportTable
              rows={filteredRows}
              onReview={review}
              emptyText={
                filtersActive
                  ? "No submissions match these filters."
                  : `No submissions recorded for ${periodLabel}.`
              }
            />
          </div>
        </>
      )}
      {tab === "themes" && (
        <>
          <div className="theme-layout">
            <div className="panel">
              <div className="panel-head">
                <div>
                  <h3>Concern themes across CHEDROs</h3>
                  <p>Completed sections in submitted consultation reports</p>
                </div>
              </div>
              <ThemeBar
                label="Student welfare concerns"
                count={themes.student}
                pct={Math.min(
                  100,
                  (themes.student / Math.max(1, periodRows.length)) * 100,
                )}
              />
              <ThemeBar
                label="Curriculum and academic programs"
                count={themes.academic}
                pct={Math.min(
                  100,
                  (themes.academic / Math.max(1, periodRows.length)) * 100,
                )}
              />
              <ThemeBar
                label="CHED initiatives and policies"
                count={themes.initiatives}
                pct={Math.min(
                  100,
                  (themes.initiatives / Math.max(1, periodRows.length)) * 100,
                )}
              />
              <ThemeBar
                label="Region-specific concerns"
                count={themes.regionSpecific}
                pct={Math.min(
                  100,
                  (themes.regionSpecific / Math.max(1, periodRows.length)) *
                    100,
                )}
              />
              <ThemeBar
                label="HEI governance concerns"
                count={themes.governance}
                pct={Math.min(
                  100,
                  (themes.governance / Math.max(1, periodRows.length)) * 100,
                )}
              />
            </div>
            <div className="panel action-panel">
              <div className="panel-head">
                <div>
                  <h3>Priority review areas</h3>
                  <p>Ranked by current-quarter reporting frequency</p>
                </div>
              </div>
              {themeRanking.slice(0, 4).map(([label, count], i) => (
                <div className="action-row" key={label}>
                  <i>{i + 1}</i>
                  <div>
                    <b>{label}</b>
                    <small>{count} submitted reports</small>
                  </div>
                  <span className={i < 2 ? "high" : "medium"}>Review</span>
                </div>
              ))}
            </div>
          </div>
          <div className="panel quote-panel">
            <div className="panel-head">
              <div>
                <h3>Notable regional signals</h3>
                <p>Representative concerns for policy review</p>
              </div>
            </div>
            <div className="quotes">
              {regionalSignals.length ? (
                regionalSignals.map((report) => (
                  <blockquote key={report.id}>
                    “{report.regionConcerns}”
                    <cite>{report.region} · Region-specific concern</cite>
                  </blockquote>
                ))
              ) : (
                <p className="empty-state">
                  No region-specific concerns have been submitted for this
                  quarter.
                </p>
              )}
            </div>
          </div>
        </>
      )}
      {tab === "compliance" && (
        <>
          <div className="stats admin-stats">
            <Stat
              icon={<CheckCircle2 />}
              n={String(completeReports)}
              label="Complete reports"
              tone="green"
            />
            <Stat
              icon={<Paperclip />}
              n={String(attendanceCount)}
              label="With attendance sheets"
              tone="blue"
            />
            <Stat
              icon={<Image />}
              n={String(photoCount)}
              label="With photo records"
              tone="purple"
            />
            <Stat
              icon={<CircleAlert />}
              n={String(followUps)}
              label="Follow-ups required"
              tone="amber"
            />
          </div>
          <div className="compliance-grid">
            <div className="panel">
              <div className="panel-head">
                <div>
                  <h3>Data quality checks</h3>
                  <p>Completeness of required Annex A sections</p>
                </div>
              </div>
              <CheckRow
                label="Consultation date and quarter"
                {...check(dateCount)}
              />
              <CheckRow
                label="Four agenda categories completed"
                {...check(agendaComplete)}
              />
              <CheckRow
                label="Attendance sheet attached"
                {...check(attendanceCount)}
              />
              <CheckRow
                label="Photo documentation attached"
                {...check(photoCount)}
              />
              <CheckRow
                label="All four signatories supplied"
                {...check(signatoriesComplete)}
              />
            </div>
            <div className="panel">
              <div className="panel-head">
                <div>
                  <h3>Pending CHEDROs</h3>
                  <p>Submission and follow-up status</p>
                </div>
              </div>
              {regions
                .filter((r) => !submittedRegions.has(r))
                .map((r) => (
                  <div className="pending-row" key={r}>
                    <div>
                      <b>{r}</b>
                      <small>No submission received for {periodLabel}</small>
                    </div>
                    <span>Follow up</span>
                  </div>
                ))}
            </div>
          </div>
        </>
      )}
      {tab === "users" && <UserAccess account={account} />}
    </>
  );
}
function MiniMetric({ label, value, detail, trend }) {
  return (
    <div className="mini-metric">
      <small>{label}</small>
      <b>{value}</b>
      <p>{detail}</p>
      <span>{trend}</span>
    </div>
  );
}
function ThemeBar({ label, count, pct }) {
  return (
    <div className="theme-bar">
      <div>
        <b>{label}</b>
        <span>{count} CHEDROs</span>
      </div>
      <div className="bar">
        <i style={{ width: pct + "%" }} />
      </div>
    </div>
  );
}
function CheckRow({ label, value, ok, warn }) {
  return (
    <div className="check-row">
      <span className={ok ? "ok" : warn ? "warn" : ""}>
        {ok ? <CheckCircle2 /> : <CircleAlert />}
      </span>
      <b>{label}</b>
      <small>{value}</small>
    </div>
  );
}
function UserAccess({ account }) {
  const [users, setUsers] = useState([]),
    [message, setMessage] = useState(""),
    // A decision can succeed while its notification email fails; that needs to
    // read as a warning, not as a plain confirmation.
    [messageWarn, setMessageWarn] = useState(false);
  useEffect(() => {
    api({ action: "listAccounts", accountToken: account.token })
      .then((d) =>
        setUsers(
          (d.rows || []).map((u) => [
            u.name,
            u.email,
            u.region,
            u.role === "central_admin" ? "Administrator" : "CHEDRO User",
            u.status === "Approved" ? "Active" : u.status,
          ]),
        ),
      )
      .catch((e) => {
        setMessage(e.message);
        setMessageWarn(true);
      });
  }, [account.token]);
  async function decide(email, approve) {
    try {
      const d = await api({
        action: "approveAccount",
        accountToken: account.token,
        email,
        approve,
      });
      setUsers((us) =>
        us.map((u) =>
          u[1] === email
            ? [...u.slice(0, 4), approve ? "Active" : "Rejected"]
            : u,
        ),
      );
      setMessage(
        d.message || (approve ? "Account approved." : "Account rejected."),
      );
      setMessageWarn(d.notified === false);
    } catch (e) {
      setMessage(e.message);
      setMessageWarn(true);
    }
  }
  return (
    <>
      <div className="stats admin-stats">
        <Stat
          icon={<Users />}
          n={String(users.filter((u) => u[4] === "Active").length)}
          label="Active users"
          tone="blue"
        />
        <Stat
          icon={<Building2 />}
          n={String(
            new Set(
              users.filter((u) => u[2] !== "Central Office").map((u) => u[2]),
            ).size,
          )}
          label="Offices represented"
          tone="green"
        />
        <Stat
          icon={<Clock3 />}
          n={String(users.filter((u) => u[4] === "Pending").length)}
          label="Pending approval"
          tone="amber"
        />
        <Stat
          icon={<ShieldCheck />}
          n={String(users.filter((u) => u[3] === "Administrator").length)}
          label="Central administrator"
          tone="purple"
        />
      </div>
      {message && (
        <p className={messageWarn ? "notice error-notice" : "notice"}>
          {message}
        </p>
      )}
      <div className="panel users-panel">
        <div className="panel-head">
          <div>
            <h3>Account requests and access</h3>
            <p>Verify each user’s identity and selected regional office</p>
          </div>
          <span className="review-count">
            {users.filter((u) => u[4] === "Pending").length} pending
          </span>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>Official email</th>
                <th>Selected office</th>
                <th>Role</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u[1]}>
                  <td>
                    <b>{u[0]}</b>
                  </td>
                  <td>{u[1]}</td>
                  <td>{u[2]}</td>
                  <td>{u[3]}</td>
                  <td>
                    <span className={"account-status " + u[4].toLowerCase()}>
                      {u[4]}
                    </span>
                  </td>
                  <td>
                    {u[4] === "Pending" ? (
                      <div className="approval-actions">
                        <button onClick={() => decide(u[1], true)}>
                          Approve
                        </button>
                        <button onClick={() => decide(u[1], false)}>
                          Reject
                        </button>
                      </div>
                    ) : (
                      <span className="no-action">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="access-note">
        <LockKeyhole />
        <div>
          <b>Account approval policy</b>
          <p>
            CHEDRO personnel select their regional office during sign-up.
            Central Office must verify that assignment before approval. Once
            approved, the region is locked to the account and automatically
            applied to every report.
          </p>
        </div>
      </div>
    </>
  );
}
createRoot(document.getElementById("root")).render(<App />);
