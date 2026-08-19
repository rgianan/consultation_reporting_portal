/** CHEDRO Consultation & Dialogue Portal backend (Google Apps Script).
 * Script properties: SPREADSHEET_ID, DRIVE_FOLDER_ID, OTP_SECRET, ALLOWED_EMAIL_DOMAIN.
 * Deploy as a Web App executed as the owner. The frontend posts text/plain JSON.
 */
var OTP_TTL = 600,
  SESSION_TTL = 7200,
  MAX_ATTEMPTS = 5;
function doPost(e) {
  try {
    var p = JSON.parse((e.postData && e.postData.contents) || "{}");
    var a = p.action;
    if (a === "requestEmailOtp") return requestOtp_(p);
    if (a === "verifyEmailOtp") return verifyOtp_(p);
    if (a === "resetPassword") return resetPassword_(p);
    if (a === "accountLogin") return accountLogin_(p);
    if (a === "registerAccount") return registerAccount_(p);
    if (a === "approveAccount") return approveAccount_(p);
    if (a === "listAccounts") return listAccounts_(p);
    if (a === "listRegionalSubmissions") return listRegionalSubmissions_(p);
    if (a === "submitDialogue") return submitDialogue_(p);
    if (a === "adminDashboard") return adminDashboard_(p);
    if (a === "reviewSubmission") return reviewSubmission_(p);
    throw new Error("Unsupported action.");
  } catch (err) {
    return out_({ ok: false, message: err.message || String(err) });
  }
}
function doGet() {
  return out_({
    ok: true,
    service: "CHEDRO Consultation & Dialogue Portal",
    version: "1.0",
  });
}
function requestOtp_(p) {
  var email = email_(p.email),
    cfg = config_();
  if (!email) throw new Error("Enter a valid official email address.");
  domain_(email, cfg);
  var c = CacheService.getScriptCache(),
    cd = "cd_" + hash_(email);
  if (c.get(cd))
    throw new Error("Please wait one minute before requesting another code.");
  var id = Utilities.getUuid(),
    code = String(Math.floor(100000 + Math.random() * 900000));
  c.put(
    "otp_" + id,
    JSON.stringify({
      email: email,
      hash: sign_(id + ":" + email + ":" + code),
      attempts: 0,
    }),
    OTP_TTL,
  );
  c.put(cd, "1", 60);
  MailApp.sendEmail({
    to: email,
    subject:
      "CHED Office of Student Development and Services verification code",
    htmlBody:
      '<p>Your verification code is:</p><p style="font-size:28px;font-weight:bold;letter-spacing:6px">' +
      code +
      "</p><p>This code expires in 10 minutes. Do not share it.</p>",
  });
  return out_({
    ok: true,
    otpRequestId: id,
    message: "Verification code sent to " + email + ".",
  });
}
function verifyOtp_(p) {
  var id = text_(p.otpRequestId, 80),
    code = String(p.otpCode || "").replace(/\D/g, ""),
    c = CacheService.getScriptCache(),
    key = "otp_" + id,
    raw = c.get(key);
  if (!raw) throw new Error("Verification code expired. Request a new code.");
  var r = JSON.parse(raw);
  if (r.attempts >= MAX_ATTEMPTS) {
    c.remove(key);
    throw new Error("Too many attempts. Request a new code.");
  }
  if (sign_(id + ":" + r.email + ":" + code) !== r.hash) {
    r.attempts++;
    c.put(key, JSON.stringify(r), OTP_TTL);
    throw new Error("Invalid verification code.");
  }
  c.remove(key);
  var token = Utilities.getUuid() + Utilities.getUuid();
  c.put("session_" + token, JSON.stringify({ email: r.email }), SESSION_TTL);
  return out_({ ok: true, email: r.email, otpSessionToken: token });
}
function session_(token) {
  var raw = CacheService.getScriptCache().get("session_" + text_(token, 100));
  if (!raw) throw new Error("Email verification expired. Please verify again.");
  var s = JSON.parse(raw);
  domain_(s.email, config_());
  return s;
}
function submitDialogue_(p) {
  var user = accountSession_(p.accountToken, ["chedro_user"]),
    required = [
      "region",
      "quarter",
      "date",
      "presidedBy",
      "rapporteur",
      "certifiedBy",
      "notedBy",
    ];
  required.forEach(function (k) {
    if (!text_(p[k], 500)) throw new Error("Missing required field: " + k);
  });
  if (p.region !== user.region)
    throw new Error("You can only submit reports for " + user.region + ".");
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var sh = sheet_("Dialogue Reports", headers_()),
      id =
        "CDR-" +
        Utilities.formatDate(
          new Date(),
          Session.getScriptTimeZone(),
          "yyyyMMdd",
        ) +
        "-" +
        String(sh.getLastRow()).padStart(4, "0");
    var files = saveReportFiles_(id, user, p.attendanceFile, p.photoFiles),
      notes = p.notes || {},
      row = [
        new Date(),
        id,
        text_(p.region, 80),
        text_(p.quarter, 30),
        text_(p.date, 30),
        num_(p.participants),
        text_(notes.initiatives, 5000),
        text_(notes.student, 5000),
        text_(notes.academic, 5000),
        text_(notes.governance, 5000),
        text_(p.regionConcerns, 5000),
        text_(p.otherMatters, 5000),
        files.attendanceUrl,
        files.photoUrls.join("\n"),
        text_(p.presidedBy, 300),
        text_(p.rapporteur, 300),
        text_(p.certifiedBy, 300),
        text_(p.notedBy, 300),
        user.email,
        user.name,
        user.role,
        "For review",
        "",
      ];
    sh.appendRow(row);
    audit_("dialogue_submitted", id, user.email, p.region);
    return out_({
      ok: true,
      submissionId: id,
      message: "Consultation report submitted.",
    });
  } finally {
    lock.releaseLock();
  }
}
function saveReportFiles_(id, user, attendance, photos) {
  var cfg = config_();
  if (!cfg.driveFolderId) throw new Error("DRIVE_FOLDER_ID is not configured.");
  if (!attendance || !attendance.data)
    throw new Error("Attendance sheet is required.");
  photos = Array.isArray(photos) ? photos : [];
  if (!photos.length) throw new Error("Photo documentation is required.");
  if (photos.length > 5) throw new Error("Attach no more than 5 photos.");
  var parent = DriveApp.getFolderById(cfg.driveFolderId),
    folder = parent.createFolder(id + " - " + user.region),
    created = [];
  function save(f, prefix) {
    if (!f || !f.data) throw new Error("Invalid attachment.");
    var bytes = Utilities.base64Decode(String(f.data));
    if (bytes.length > 5 * 1024 * 1024)
      throw new Error(String(f.name || "Attachment") + " exceeds 5 MB.");
    var safe = text_(f.name, 180).replace(/[\\/:*?"<>|]/g, "_"),
      blob = Utilities.newBlob(
        bytes,
        text_(f.type, 120) || "application/octet-stream",
        prefix + " - " + safe,
      ),
      file = folder.createFile(blob);
    created.push(file);
    return file.getUrl();
  }
  try {
    return {
      attendanceUrl: save(attendance, "Attendance"),
      photoUrls: photos.map(function (f, i) {
        return save(f, "Photo " + (i + 1));
      }),
    };
  } catch (err) {
    created.forEach(function (f) {
      try {
        f.setTrashed(true);
      } catch (e) {}
    });
    try {
      folder.setTrashed(true);
    } catch (e) {}
    throw err;
  }
}

// ---- Approved named accounts ----
function usersHeaders_() {
  return [
    "Email",
    "Password_Hash",
    "Password_Salt",
    "Display_Name",
    "Role",
    "Region",
    "Active",
    "Account_Status",
    "Invite_Hash",
    "Invite_Expires",
    "Created_At",
    "Last_Login",
  ];
}
function accountLogin_(p) {
  var email = email_(p.email),
    password = String(p.password || "");
  if (!email || !password) throw new Error("Email and password are required.");
  var found = findAccount_(email);
  if (found && found.row.Account_Status === "Pending")
    throw new Error("Your account is awaiting Central Office approval.");
  if (found && found.row.Account_Status === "Rejected")
    throw new Error(
      "Your account request was not approved. Contact Central Office for assistance.",
    );
  if (
    !found ||
    String(found.row.Active).toLowerCase() === "false" ||
    found.row.Account_Status !== "Approved" ||
    !found.row.Password_Hash
  )
    throw new Error("Invalid credentials or inactive account.");
  if (pwHash_(password, found.row.Password_Salt) !== found.row.Password_Hash)
    throw new Error("Invalid credentials or inactive account.");
  found.sheet
    .getRange(found.index + 1, found.map.Last_Login + 1)
    .setValue(new Date());
  var user = {
    email: email,
    name: found.row.Display_Name,
    role: found.row.Role,
    region: found.row.Region,
  };
  var token = Utilities.getUuid() + Utilities.getUuid();
  CacheService.getScriptCache().put(
    "account_" + token,
    JSON.stringify(user),
    SESSION_TTL,
  );
  audit_("account_login", "", email, user.region);
  return out_({
    ok: true,
    accountToken: token,
    email: email,
    displayName: user.name,
    role: user.role,
    region: user.region,
  });
}
function registerAccount_(p) {
  var email = email_(p.email),
    password = String(p.password || ""),
    name = text_(p.name, 200),
    region = text_(p.region, 80),
    allowed = [
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
  if (!email || !name || allowed.indexOf(region) < 0)
    throw new Error(
      "Enter your name, official email and CHED Regional Office.",
    );
  domain_(email, config_());
  if (password.length < 12)
    throw new Error("Use a password of at least 12 characters.");
  if (findAccount_(email))
    throw new Error("An account request already exists for this email.");
  var salt = Utilities.getUuid(),
    sh = sheet_("Users", usersHeaders_());
  sh.appendRow([
    email,
    pwHash_(password, salt),
    salt,
    name,
    "chedro_user",
    region,
    false,
    "Pending",
    "",
    "",
    new Date(),
    "",
  ]);
  audit_("account_requested", "", email, region);
  return out_({
    ok: true,
    message:
      "Account request submitted. Central Office will review your regional assignment before you can sign in.",
  });
}
function approveAccount_(p) {
  var admin = accountSession_(p.accountToken, ["central_admin"]),
    email = email_(p.email),
    approve = p.approve !== false,
    f = findAccount_(email);
  if (!f || f.row.Role !== "chedro_user")
    throw new Error("Account request not found.");
  f.sheet.getRange(f.index + 1, f.map.Active + 1).setValue(approve);
  f.sheet
    .getRange(f.index + 1, f.map.Account_Status + 1)
    .setValue(approve ? "Approved" : "Rejected");
  audit_(
    approve ? "account_approved" : "account_rejected",
    "",
    admin.email,
    email + " / " + f.row.Region,
  );
  // The decision is already written. A mail failure (quota, bad address) must
  // not fail the request, or the account ends up approved while the admin is
  // told it was not - so report it back instead of throwing.
  var decision = approve ? "Account approved." : "Account rejected.",
    notice = notify_(
      email,
      "CHED Office of Student Development and Services account " +
        (approve ? "approved" : "reviewed"),
      approve
        ? "<p>Your account for <b>" +
            f.row.Region +
            "</b> has been approved. You may now sign in.</p>"
        : "<p>Your account request could not be approved. Contact Central Office if you need assistance.</p>",
      admin.email,
    );
  return out_({
    ok: true,
    notified: notice.sent,
    message: notice.sent ? decision : decision + " " + notice.warning,
  });
}
/** Send a notification without letting a mail failure undo work already
 * committed to the sheet. Returns whether it went out. */
function notify_(to, subject, htmlBody, actorEmail) {
  try {
    MailApp.sendEmail({ to: to, subject: subject, htmlBody: htmlBody });
    return { sent: true, warning: "" };
  } catch (mailErr) {
    var reason = mailErr && mailErr.message ? mailErr.message : String(mailErr);
    // The audit write is best-effort too: letting it throw here would undo the
    // very guarantee this helper exists to provide.
    try {
      audit_("notification_failed", "", actorEmail || "", to + " / " + reason);
    } catch (auditErr) {}
    return {
      sent: false,
      warning:
        "The notification email to " + to + " could not be sent: " + reason,
    };
  }
}
function listAccounts_(p) {
  accountSession_(p.accountToken, ["central_admin"]);
  var sh = sheet_("Users", usersHeaders_()),
    v = sh.getDataRange().getValues(),
    h = v[0],
    map = {};
  h.forEach(function (x, i) {
    map[x] = i;
  });
  var rows = [];
  for (var i = 1; i < v.length; i++)
    rows.push({
      name: String(v[i][map.Display_Name] || ""),
      email: String(v[i][map.Email] || ""),
      region: String(v[i][map.Region] || ""),
      role: String(v[i][map.Role] || ""),
      status: String(
        v[i][map.Account_Status] || (v[i][map.Active] ? "Approved" : "Pending"),
      ),
    });
  return out_({ ok: true, rows: rows });
}
function resetPassword_(p) {
  var verified = session_(p.otpSessionToken),
    password = String(p.password || "");
  if (password.length < 12)
    throw new Error("Use a password of at least 12 characters.");
  var f = findAccount_(verified.email);
  if (!f || f.row.Account_Status !== "Approved")
    throw new Error("Approved account not found.");
  var salt = Utilities.getUuid();
  f.sheet.getRange(f.index + 1, f.map.Password_Salt + 1).setValue(salt);
  f.sheet
    .getRange(f.index + 1, f.map.Password_Hash + 1)
    .setValue(pwHash_(password, salt));
  audit_("password_reset", "", verified.email, f.row.Region);
  return out_({ ok: true, message: "Password updated. You may now sign in." });
}
function accountSession_(token, roles) {
  var raw = CacheService.getScriptCache().get("account_" + text_(token, 100));
  if (!raw) throw new Error("Your session expired. Please sign in again.");
  var u = JSON.parse(raw);
  if (roles && roles.indexOf(u.role) < 0)
    throw new Error("You do not have permission for this action.");
  return u;
}
function findAccount_(email) {
  var sh = sheet_("Users", usersHeaders_()),
    v = sh.getDataRange().getValues(),
    h = v[0],
    map = {};
  h.forEach(function (x, i) {
    map[x] = i;
  });
  for (var i = 1; i < v.length; i++)
    if (email_(v[i][map.Email]) === email) {
      var row = {};
      h.forEach(function (x, j) {
        row[x] = v[i][j];
      });
      return { sheet: sh, index: i, map: map, row: row };
    }
  return null;
}
function pwHash_(password, salt) {
  var out = String(password) + ":" + salt,
    secret = config_().secret + ":" + salt;
  for (var i = 0; i < 4000; i++)
    out = Utilities.base64EncodeWebSafe(
      Utilities.computeHmacSha256Signature(out, secret),
    );
  return out;
}
function listRegionalSubmissions_(p) {
  var u = accountSession_(p.accountToken, ["chedro_user"]),
    v = sheet_("Dialogue Reports", headers_())
      .getDataRange()
      .getDisplayValues(),
    rows = [];
  for (var i = 1; i < v.length; i++)
    if (v[i][2] === u.region)
      rows.push({
        // yearOf() falls back to this when the sheet renders consultation
        // dates without a four-digit year.
        timestamp: v[i][0],
        id: v[i][1],
        region: v[i][2],
        quarter: v[i][3],
        date: v[i][4],
        participants: Number(v[i][5] || 0),
        initiatives: v[i][6],
        student: v[i][7],
        academic: v[i][8],
        governance: v[i][9],
        regionConcerns: v[i][10],
        otherMatters: v[i][11],
        attendanceFile: v[i][12],
        photoFiles: v[i][13],
        presidedBy: v[i][14],
        rapporteur: v[i][15],
        certifiedBy: v[i][16],
        notedBy: v[i][17],
        submittedBy: v[i][19],
        status: v[i][21],
        remarks: v[i][22],
      });
  return out_({ ok: true, region: u.region, rows: rows });
}
function adminDashboard_(p) {
  accountSession_(p.accountToken || p.adminToken, [
    "central_admin",
    "central_reviewer",
  ]);
  var sh = sheet_("Dialogue Reports", headers_()),
    v = sh.getDataRange().getDisplayValues(),
    rows = [];
  for (var i = 1; i < v.length; i++)
    rows.push({
      timestamp: v[i][0],
      id: v[i][1],
      region: v[i][2],
      quarter: v[i][3],
      date: v[i][4],
      participants: Number(v[i][5] || 0),
      initiatives: v[i][6],
      student: v[i][7],
      academic: v[i][8],
      governance: v[i][9],
      regionConcerns: v[i][10],
      otherMatters: v[i][11],
      attendanceFile: v[i][12],
      photoFiles: v[i][13],
      presidedBy: v[i][14],
      rapporteur: v[i][15],
      certifiedBy: v[i][16],
      notedBy: v[i][17],
      email: v[i][18],
      submittedBy: v[i][19],
      status: v[i][21],
      remarks: v[i][22],
    });
  var byRegion = {},
    themes = {
      initiatives: 0,
      student: 0,
      academic: 0,
      governance: 0,
      regionSpecific: 0,
    };
  rows.forEach(function (r) {
    byRegion[r.region] = (byRegion[r.region] || 0) + 1;
    if (r.initiatives) themes.initiatives++;
    if (r.student) themes.student++;
    if (r.academic) themes.academic++;
    if (r.governance) themes.governance++;
    if (r.regionConcerns) themes.regionSpecific++;
  });
  return out_({
    ok: true,
    rows: rows,
    summary: {
      reports: rows.length,
      participants: rows.reduce(function (n, r) {
        return n + r.participants;
      }, 0),
      byRegion: byRegion,
      themes: themes,
    },
  });
}
/** Central Office review decision: set a submission status and remarks. */
function reviewSubmission_(p) {
  var admin = accountSession_(p.accountToken, [
      "central_admin",
      "central_reviewer",
    ]),
    reference = text_(p.reference, 60),
    status = text_(p.status, 40),
    remarks = text_(p.remarks, 2000),
    allowed = ["For review", "Validated", "Needs revision"];
  if (!reference) throw new Error("Missing report reference.");
  if (allowed.indexOf(status) < 0) throw new Error("Unsupported status.");
  if (status === "Needs revision" && !remarks)
    throw new Error("Enter remarks explaining what the CHEDRO must revise.");
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var sh = sheet_("Dialogue Reports", headers_()),
      v = sh.getDataRange().getValues(),
      h = headers_(),
      statusCol = h.indexOf("Status") + 1,
      remarksCol = h.indexOf("Admin_Remarks") + 1;
    for (var i = 1; i < v.length; i++)
      if (String(v[i][1]) === reference) {
        sh.getRange(i + 1, statusCol).setValue(status);
        sh.getRange(i + 1, remarksCol).setValue(remarks);
        audit_(
          "submission_reviewed",
          reference,
          admin.email,
          status + (remarks ? " / " + remarks : ""),
        );
        var recipient = email_(v[i][18]),
          notice = { sent: true, warning: "" };
        if (recipient && status !== "For review")
          notice = notify_(
            recipient,
            "Consultation report " + reference + " marked " + status,
            "<p>Your consultation and dialogue report <b>" +
              reference +
              "</b> for " +
              String(v[i][2]) +
              " (" +
              String(v[i][3]) +
              ") has been marked <b>" +
              status +
              "</b> by the Central Office.</p>" +
              (remarks ? "<p>Remarks: " + remarks + "</p>" : ""),
            admin.email,
          );
        return out_({
          ok: true,
          reference: reference,
          status: status,
          remarks: remarks,
          notified: notice.sent,
          message:
            "Report marked " +
            status +
            "." +
            (notice.sent ? "" : " " + notice.warning),
        });
      }
    throw new Error("Report " + reference + " was not found.");
  } finally {
    lock.releaseLock();
  }
}
function headers_() {
  return [
    "Timestamp",
    "Reference",
    "Region",
    "Quarter",
    "Consultation_Date",
    "Participants",
    "CHED_Initiatives_Programs_Policies",
    "Student_Welfare_Concerns",
    "Curriculum_Academic_Programs",
    "HEI_Governance_Concerns",
    "Region_Specific_Concerns",
    "Other_Matters",
    "Attendance_File_URL",
    "Photo_File_URLs",
    "Presided_By",
    "Rapporteur",
    "Certified_By",
    "Noted_By",
    "Submitted_By_Email",
    "Submitted_By_Name",
    "Submitted_By_Role",
    "Status",
    "Admin_Remarks",
  ];
}
function sheet_(name, headers) {
  var ss = SpreadsheetApp.openById(config_().spreadsheetId),
    sh = ss.getSheetByName(name) || ss.insertSheet(name);
  if (sh.getLastRow() === 0) sh.appendRow(headers);
  return sh;
}
function audit_(action, ref, email, detail) {
  sheet_("Audit Log", [
    "Timestamp",
    "Action",
    "Reference",
    "Email",
    "Detail",
  ]).appendRow([new Date(), action, ref, email, detail]);
}
function config_() {
  var p = PropertiesService.getScriptProperties();
  return {
    spreadsheetId: p.getProperty("SPREADSHEET_ID"),
    secret: p.getProperty("OTP_SECRET"),
    domain: String(
      p.getProperty("ALLOWED_EMAIL_DOMAIN") || "ched.gov.ph",
    ).toLowerCase(),
    driveFolderId: p.getProperty("DRIVE_FOLDER_ID"),
  };
}
function domain_(e, c) {
  if (c.domain && e.split("@")[1] !== c.domain)
    throw new Error("Please use your @" + c.domain + " email address.");
}
function sign_(s) {
  var secret = config_().secret;
  if (!secret) throw new Error("OTP_SECRET is not configured.");
  return Utilities.base64EncodeWebSafe(
    Utilities.computeHmacSha256Signature(String(s), secret),
  );
}
function hash_(s) {
  return Utilities.base64EncodeWebSafe(
    Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s),
  ).slice(0, 28);
}
function email_(v) {
  var e = text_(v, 254).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : "";
}
function text_(v, n) {
  return String(v == null ? "" : v)
    .replace(/[<>]/g, "")
    .trim()
    .slice(0, n || 500);
}
function num_(v) {
  var n = Number(v);
  return isFinite(n) && n >= 0 ? n : 0;
}
function out_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(
    ContentService.MimeType.JSON,
  );
}
/** Run once after setting SPREADSHEET_ID and DRIVE_FOLDER_ID in Script Properties. */
function setupPortal() {
  var props = PropertiesService.getScriptProperties(),
    current = props.getProperties(),
    updates = {};
  if (!current.SPREADSHEET_ID || !current.DRIVE_FOLDER_ID)
    throw new Error(
      "Set SPREADSHEET_ID and DRIVE_FOLDER_ID in Project Settings > Script properties before running setupPortal().",
    );
  SpreadsheetApp.openById(current.SPREADSHEET_ID);
  DriveApp.getFolderById(current.DRIVE_FOLDER_ID);
  if (!current.OTP_SECRET)
    updates.OTP_SECRET = Utilities.getUuid() + Utilities.getUuid();
  if (!current.ALLOWED_EMAIL_DOMAIN)
    updates.ALLOWED_EMAIL_DOMAIN = "ched.gov.ph";
  props.setProperties(updates, false);
  sheet_("Dialogue Reports", headers_());
  sheet_("Users", usersHeaders_());
  sheet_("Audit Log", ["Timestamp", "Action", "Reference", "Email", "Detail"]);
}
function seedAdmin() {
  var props = PropertiesService.getScriptProperties(),
    email = email_(props.getProperty("INITIAL_ADMIN_EMAIL")),
    password = String(props.getProperty("INITIAL_ADMIN_PASSWORD") || ""),
    displayName = text_(
      props.getProperty("INITIAL_ADMIN_NAME") || "Portal Administrator",
      200,
    );
  if (!email) throw new Error("Set INITIAL_ADMIN_EMAIL in Script Properties.");
  domain_(email, config_());
  if (password.length < 12)
    throw new Error(
      "Set INITIAL_ADMIN_PASSWORD to a password of at least 12 characters.",
    );
  if (findAccount_(email)) throw new Error("Admin account already exists.");
  var salt = Utilities.getUuid(),
    sh = sheet_("Users", usersHeaders_());
  sh.appendRow([
    email,
    pwHash_(password, salt),
    salt,
    displayName,
    "central_admin",
    "Central Office",
    true,
    "Approved",
    "",
    "",
    new Date(),
    "",
  ]);
  props.deleteProperty("INITIAL_ADMIN_PASSWORD");
}
