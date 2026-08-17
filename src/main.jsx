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
  SlidersHorizontal,
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
const sample = [
  {
    id: "CDR-2026-041",
    region: "Region IV-A",
    quarter: "2nd Quarter",
    date: "Jun 18, 2026",
    status: "For review",
    participants: 84,
    concerns: 7,
  },
  {
    id: "CDR-2026-040",
    region: "Region VII",
    quarter: "2nd Quarter",
    date: "Jun 12, 2026",
    status: "Validated",
    participants: 61,
    concerns: 5,
  },
  {
    id: "CDR-2026-039",
    region: "Region III",
    quarter: "2nd Quarter",
    date: "Jun 06, 2026",
    status: "Needs revision",
    participants: 103,
    concerns: 9,
  },
  {
    id: "CDR-2026-038",
    region: "Region XI",
    quarter: "2nd Quarter",
    date: "May 29, 2026",
    status: "Validated",
    participants: 48,
    concerns: 4,
  },
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
              <i />
            </button>
            {notifications && (
              <div className="notification-pop">
                <b>Notifications</b>
                <p>
                  {admin
                    ? "3 account requests await review."
                    : "Quarter 2 report is due September 30."}
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
          <div className="demo">
            <span>Interactive preview</span>
            <button
              onClick={() =>
                onLogin({
                  token: "demo-chedro",
                  email: "maria.reyes@ched.gov.ph",
                  name: "Maria Reyes",
                  role: "chedro_user",
                  region: "Region IV-A",
                })
              }
            >
              Enter as CHEDRO
            </button>
            <button
              onClick={() =>
                onLogin({
                  token: "demo-admin",
                  email: "admin@ched.gov.ph",
                  name: "Ana Santos",
                  role: "central_admin",
                  region: "Central Office",
                })
              }
            >
              Enter as Central Office
            </button>
          </div>
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
  return (
    <>
      <div className="hero">
        <div>
          <span className="eyebrow">2nd Quarter · AY 2026–2027</span>
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
          <span>Submission progress</span>
          <b>1 of 1</b>
          <div className="progress">
            <i />
          </div>
          <p>
            <CheckCircle2 /> Quarter 1 report accepted
          </p>
          <small>Quarter 2 due September 30, 2026</small>
        </div>
      </div>
      <div className="stats">
        <Stat icon={<FileText />} n="4" label="Reports submitted" tone="blue" />
        <Stat icon={<CheckCircle2 />} n="3" label="Validated" tone="green" />
        <Stat icon={<Clock3 />} n="1" label="Under review" tone="amber" />
        <Stat
          icon={<Users />}
          n="296"
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
          <ReportTable
            rows={sample
              .slice(0, 3)
              .map((r) => ({ ...r, region: account.region }))}
          />
        </div>
        <div className="panel timeline">
          <div className="panel-head">
            <div>
              <h3>Quarterly timeline</h3>
              <p>Reporting year 2026</p>
            </div>
          </div>
          {[
            "Q1 · Submitted",
            "Q2 · In progress",
            "Q3 · Opens Oct 1",
            "Q4 · Opens Jan 1",
          ].map((x, i) => (
            <div className={i < 2 ? "mile done" : "mile"} key={x}>
              <i>{i < 2 ? <CheckCircle2 /> : i + 1}</i>
              <div>
                <b>{x}</b>
                <small>
                  {i === 0
                    ? "Accepted March 28"
                    : i === 1
                      ? "Due September 30"
                      : "Not yet available"}
                </small>
              </div>
            </div>
          ))}
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
    quarter: "2nd Quarter",
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
      if (account.token === "demo-chedro") {
        done();
        return;
      }
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
                {[
                  "1st Quarter",
                  "2nd Quarter",
                  "3rd Quarter",
                  "4th Quarter",
                ].map((q) => (
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
function downloadCsv(rows, name = "chedro-dialogue-reports.csv") {
  const cols = ["id", "region", "quarter", "date", "status"];
  const csv = [
    cols.join(","),
    ...rows.map((r) =>
      cols
        .map((c) => `"${String(r[c] ?? "").replaceAll('"', '""')}"`)
        .join(","),
    ),
  ].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" })),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
function Reports({ account }) {
  const [rows, setRows] = useState(
      account.token === "demo-chedro"
        ? sample.map((r) => ({ ...r, region: account.region }))
        : [],
    ),
    [error, setError] = useState(""),
    [query, setQuery] = useState(""),
    [validatedOnly, setValidatedOnly] = useState(false);
  useEffect(() => {
    if (account.token === "demo-chedro") return;
    api({ action: "listRegionalSubmissions", accountToken: account.token })
      .then((d) => setRows(d.rows || []))
      .catch((e) => setError(e.message));
  }, [account.token]);
  const filtered = rows.filter(
    (r) =>
      (!validatedOnly || r.status === "Validated") &&
      [r.id, r.region, r.quarter, r.date, r.status]
        .join(" ")
        .toLowerCase()
        .includes(query.toLowerCase()),
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
      <div className="panel reports">
        <div className="toolbar">
          <div className="search">
            <Search />
            <input
              aria-label="Search reports"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search reports or reference…"
            />
          </div>
          <button
            className={validatedOnly ? "filter-on" : ""}
            onClick={() => setValidatedOnly(!validatedOnly)}
          >
            <SlidersHorizontal />
            {validatedOnly ? "Validated only" : "All statuses"}
          </button>
          <button onClick={() => downloadCsv(filtered)}>
            <Download />
            Export
          </button>
        </div>
        <ReportTable rows={filtered} />
      </div>
    </>
  );
}
function ReportTable({ rows }) {
  const [open, setOpen] = useState("");
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
                <td>{r.quarter}</td>
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
                    <b>
                      {r.id} · {r.region}
                    </b>
                    <p>
                      Consultation held {r.date} for {r.quarter}. Current review
                      status: {r.status}.
                    </p>
                    {r.submittedBy && (
                      <small>Submitted by {r.submittedBy}</small>
                    )}
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
function Status({ s }) {
  return (
    <span className={"status " + s.toLowerCase().replaceAll(" ", "-")}>
      {s}
    </span>
  );
}
function Admin({ tab, setTab, account }) {
  const [live, setLive] = useState(null),
    [loadError, setLoadError] = useState("");
  useEffect(() => {
    if (account.token === "demo-admin") return;
    api({ action: "adminDashboard", accountToken: account.token })
      .then(setLive)
      .catch((e) => setLoadError(e.message));
  }, [account.token]);
  const total = 17,
    adminRows = live?.rows || sample,
    submitted = live ? Object.keys(live.summary?.byRegion || {}).length : 14,
    coverage = Math.round((submitted / total) * 100),
    participants = live?.summary?.participants ?? 1248,
    themes = live?.summary?.themes || {
      initiatives: 7,
      student: 8,
      academic: 6,
      governance: 3,
      regionSpecific: 5,
    },
    concerns = Object.values(themes).reduce((a, b) => a + Number(b || 0), 0),
    validated = live
      ? adminRows.filter((r) => r.status === "Validated").length
      : 10;
  return (
    <>
      <div className="admin-top">
        <div className="period">
          <CalendarDays />
          <div>
            <small>Reporting period</small>
            <b>2nd Quarter · 2026</b>
          </div>
          <ChevronRight />
        </div>
        <button
          className="primary"
          onClick={() =>
            downloadCsv(adminRows, "chedro-consolidated-report.csv")
          }
        >
          <Download />
          Export consolidated report
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
                {regions.map((r, i) => (
                  <div
                    className={i < submitted ? "region sent" : "region"}
                    key={r}
                  >
                    <i>{i < submitted ? <CheckCircle2 /> : <Clock3 />}</i>
                    <span>{r}</span>
                    <small>
                      {i < 10
                        ? "Validated"
                        : i < submitted
                          ? "For review"
                          : "Pending"}
                    </small>
                  </div>
                ))}
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
              label="On-time submission"
              value="86%"
              detail="12 of 14 received before deadline"
              trend="+8 pts from Q1"
            />
            <MiniMetric
              label="Report completeness"
              value="92%"
              detail="Required evidence and signatories"
              trend="+3 pts from Q1"
            />
            <MiniMetric
              label="Average participants"
              value="89"
              detail="Per regional consultation"
              trend="1,248 participants total"
            />
            <MiniMetric
              label="Action closure rate"
              value="64%"
              detail="32 of 50 agreed actions completed"
              trend="18 actions remain open"
            />
          </div>
        </>
      )}
      {tab === "submissions" && (
        <>
          <div className="stats admin-stats">
            <Stat
              icon={<FileText />}
              n={String(adminRows.length)}
              label="Received"
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
              n={String(
                adminRows.filter((r) => r.status === "For review").length,
              )}
              label="For review"
              tone="amber"
            />
            <Stat
              icon={<CircleAlert />}
              n={String(
                adminRows.filter((r) => r.status === "Needs revision").length,
              )}
              label="Needs revision"
              tone="purple"
            />
          </div>
          <div className="panel">
            <div className="panel-head">
              <div>
                <h3>Regional submissions</h3>
                <p>Review, validate and follow up with reporting offices</p>
              </div>
              <div className="legend">
                <i className="green-dot" />
                Validated <i className="amber-dot" />
                For review
              </div>
            </div>
            <ReportTable rows={adminRows} />
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
                  (themes.student / Math.max(1, adminRows.length)) * 100,
                )}
              />
              <ThemeBar
                label="Curriculum and academic programs"
                count={themes.academic}
                pct={Math.min(
                  100,
                  (themes.academic / Math.max(1, adminRows.length)) * 100,
                )}
              />
              <ThemeBar
                label="CHED initiatives and policies"
                count={themes.initiatives}
                pct={Math.min(
                  100,
                  (themes.initiatives / Math.max(1, adminRows.length)) * 100,
                )}
              />
              <ThemeBar
                label="Region-specific concerns"
                count={themes.regionSpecific}
                pct={Math.min(
                  100,
                  (themes.regionSpecific / Math.max(1, adminRows.length)) * 100,
                )}
              />
              <ThemeBar
                label="HEI governance concerns"
                count={themes.governance}
                pct={Math.min(
                  100,
                  (themes.governance / Math.max(1, adminRows.length)) * 100,
                )}
              />
            </div>
            <div className="panel action-panel">
              <div className="panel-head">
                <div>
                  <h3>Recommended Central Office actions</h3>
                  <p>Consolidated from regional agreements</p>
                </div>
              </div>
              {[
                [
                  "Issue subsidy clarification",
                  "Office of Student Development",
                  "High",
                ],
                ["Issue curriculum consultation guidance", "OPSD", "High"],
                ["Develop student welfare referral protocol", "OSDS", "Medium"],
                ["Convene connectivity working group", "ICTS", "Medium"],
              ].map((a, i) => (
                <div className="action-row" key={a[0]}>
                  <i>{i + 1}</i>
                  <div>
                    <b>{a[0]}</b>
                    <small>{a[1]}</small>
                  </div>
                  <span className={a[2].toLowerCase()}>{a[2]}</span>
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
              <blockquote>
                “Students requested a unified explanation of scholarship
                eligibility and release timelines.”
                <cite>Region IV-A · Student welfare</cite>
              </blockquote>
              <blockquote>
                “Employers asked to participate earlier in regional curriculum
                consultations.”<cite>Region VII · Academic programs</cite>
              </blockquote>
              <blockquote>
                “Campus guidance offices need a shared referral protocol for
                high-risk cases.”<cite>NIR · Student welfare</cite>
              </blockquote>
            </div>
          </div>
        </>
      )}
      {tab === "compliance" && (
        <>
          <div className="stats admin-stats">
            <Stat
              icon={<CheckCircle2 />}
              n="13"
              label="Complete reports"
              tone="green"
            />
            <Stat
              icon={<Paperclip />}
              n="12"
              label="With attendance sheets"
              tone="blue"
            />
            <Stat
              icon={<Image />}
              n="11"
              label="With photo records"
              tone="purple"
            />
            <Stat
              icon={<CircleAlert />}
              n="5"
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
                value="14/14"
                ok
              />
              <CheckRow
                label="Four agenda categories completed"
                value="13/14"
                warn
              />
              <CheckRow label="Attendance sheet attached" value="12/14" warn />
              <CheckRow
                label="Photo documentation attached"
                value="11/14"
                warn
              />
              <CheckRow
                label="All four signatories supplied"
                value="13/14"
                warn
              />
            </div>
            <div className="panel">
              <div className="panel-head">
                <div>
                  <h3>Pending CHEDROs</h3>
                  <p>Submission and follow-up status</p>
                </div>
              </div>
              {["Region IX", "Region XII", "CARAGA"].map((r, i) => (
                <div className="pending-row" key={r}>
                  <div>
                    <b>{r}</b>
                    <small>
                      {i < 2
                        ? "Reminder sent Aug 14"
                        : "No submission received"}
                    </small>
                  </div>
                  <span>{i < 2 ? "Awaiting" : "Follow up"}</span>
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
  const [users, setUsers] = useState([
      [
        "Paolo Garcia",
        "paolo.garcia@ched.gov.ph",
        "Region III",
        "CHEDRO User",
        "Pending",
      ],
      [
        "Maria Reyes",
        "maria.reyes@ched.gov.ph",
        "Region IV-A",
        "CHEDRO User",
        "Active",
      ],
      ["Joel Ramos", "joel.ramos@ched.gov.ph", "NIR", "CHEDRO User", "Active"],
      [
        "Liza Cruz",
        "liza.cruz@ched.gov.ph",
        "Region VII",
        "CHEDRO User",
        "Active",
      ],
      [
        "Ana Santos",
        "ana.santos@ched.gov.ph",
        "Central Office",
        "Administrator",
        "Active",
      ],
    ]),
    [message, setMessage] = useState("");
  useEffect(() => {
    if (account.token === "demo-admin") return;
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
      .catch((e) => setMessage(e.message));
  }, [account.token]);
  async function decide(email, approve) {
    try {
      if (account.token !== "demo-admin")
        await api({
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
      setMessage(approve ? "Account approved." : "Account rejected.");
    } catch (e) {
      setMessage(e.message);
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
      {message && <p className="notice">{message}</p>}
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
