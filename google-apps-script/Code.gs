/** CHEDRO Consultation & Dialogue Portal backend (Google Apps Script).
 * Script properties: SPREADSHEET_ID, DRIVE_FOLDER_ID, OTP_SECRET,
 * ALLOWED_EMAIL_DOMAIN, PORTAL_URL, ATTACHMENT_SHARING.
 * Deploy as a Web App executed as the owner. The frontend posts text/plain JSON.
 */
var OTP_TTL = 600,
  SESSION_TTL = 7200,
  MAX_ATTEMPTS = 5,
  // Sign-in throttling. Eight guesses per quarter hour caps an attacker at
  // roughly 770 a day against a 12-character minimum, while a legitimate user
  // who mistypes their password is never locked out for longer than the window.
  LOGIN_MAX_FAILURES = 8,
  LOGIN_WINDOW = 900,
  // Ceiling on password-reset emails across the whole portal per hour. The
  // reset endpoint is the only one that sends mail without a session, so it is
  // the only way an outsider can reach the daily MailApp quota - and draining
  // that quota would also silence approval and review notifications.
  OTP_GLOBAL_CAP = 60,
  OTP_GLOBAL_WINDOW = 3600,
  // Set by the system, never by a reviewer, when a returned report is replaced
  // by a corrected one. Superseded rows stay on the sheet for the audit trail
  // but are out of every count and every live view.
  SUPERSEDED = "Superseded",
  // The one-live-report-per-quarter rule keys on this value, so it has to come
  // from a fixed set. Left as free text, "Q3" and "3rd quarter" would each open
  // their own bucket and a second report would slip past the duplicate check.
  QUARTERS = ["1st Quarter", "2nd Quarter", "3rd Quarter", "4th Quarter"],
  REGIONS = [
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
  ],
  CENTRAL_OFFICE = "Central Office",
  // How long a Central Office invitation stays usable, in days.
  INVITE_TTL_DAYS = 7,
  // A consultation cannot plausibly exceed this; anything above it is a typo or
  // a bad client, and it would distort every national total it lands in.
  MAX_PARTICIPANTS = 1000000,
  PORTAL_NAME = "CHED-OSDS Consultation & Dialogue Reporting Portal";
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
    if (a === "inviteAccount") return inviteAccount_(p);
    if (a === "resendInvite") return resendInvite_(p);
    if (a === "revokeInvite") return revokeInvite_(p);
    if (a === "inviteDetails") return inviteDetails_(p);
    if (a === "acceptInvite") return acceptInvite_(p);
    if (a === "listRegionalSubmissions") return listRegionalSubmissions_(p);
    if (a === "submitDialogue") return submitDialogue_(p);
    if (a === "adminDashboard") return adminDashboard_(p);
    if (a === "reviewSubmission") return reviewSubmission_(p);
    throw new Error("Unsupported action.");
  } catch (err) {
    return out_({
      ok: false,
      // "SESSION" tells the portal to send the user back to sign-in rather than
      // stranding them on a page whose every request will now fail.
      code: err && err.code ? err.code : "",
      message: err.message || String(err),
    });
  }
}
function doGet() {
  return out_({
    ok: true,
    service: "CHEDRO Consultation & Dialogue Portal",
    version: "1.0",
  });
}
/**
 * Issue a password-reset code. This is the only action that both sends mail
 * and takes no session, so it is deliberately uninformative: an address with
 * no approved account gets the same request id, the same message and the same
 * downstream behaviour as one that does - it simply never receives an email.
 * Anything that branched visibly here would let an outsider enumerate staff
 * accounts, and mail every address it found on the way.
 */
function requestOtp_(p) {
  var email = email_(p.email),
    cfg = config_();
  if (!email) throw new Error("Enter a valid official email address.");
  domain_(email, cfg);
  var c = CacheService.getScriptCache(),
    cd = "cd_" + hash_(email);
  if (c.get(cd))
    throw new Error("Please wait one minute before requesting another code.");
  c.put(cd, "1", 60);
  var id = Utilities.getUuid(),
    code = String(Math.floor(100000 + Math.random() * 900000));
  // Stored for the decoy path too, so a caller probing an address with no
  // account walks the same road: "Invalid verification code." on a wrong guess
  // and "Too many attempts." after five, rather than an immediate expiry that
  // would give the absence of an account away.
  c.put(
    "otp_" + id,
    JSON.stringify({
      email: email,
      hash: sign_(id + ":" + email + ":" + code),
      attempts: 0,
    }),
    OTP_TTL,
  );
  var f = findAccount_(email),
    deliverable = !!(f && f.row.Account_Status === "Approved");
  // Reply before considering the send, so the presence of an account cannot be
  // read off the response. resetPassword_() re-checks the account anyway.
  var reply = out_({
    ok: true,
    otpRequestId: id,
    message:
      "If " +
      email +
      " has an approved portal account, a six-digit code is on its way.",
  });
  if (!deliverable) return reply;
  if (bump_(windowKey_("otpmail", OTP_GLOBAL_WINDOW), OTP_GLOBAL_WINDOW) >
    OTP_GLOBAL_CAP) {
    // Tripping this is a portal-wide event worth seeing in the log; the cap is
    // far above normal use, so reaching it means something is walking the
    // address space. Still answered as a success for the reason above.
    tryAudit_(
      "otp_quota_blocked",
      "",
      email,
      "Hourly reset-email cap of " + OTP_GLOBAL_CAP + " reached",
    );
    return reply;
  }
  // A send failure is recorded rather than surfaced. The older behaviour raised
  // it to the caller, which read better for the person waiting on the code, but
  // it also meant a mail outage turned this endpoint into the account oracle
  // the rest of the function exists to prevent.
  notify_(
    email,
    PORTAL_NAME + ": Password reset code",
    emailBody_({
      heading: "Your verification code",
      intro:
        "Use the code below to reset the password for your portal account.",
      code: code,
      details: [
        ["Account", email],
        ["Requested", stamp_()],
        ["Valid for", "10 minutes"],
      ],
      next:
        "Do not share this code with anyone. If you did not request a password reset, you can ignore this email and your password will stay unchanged.",
      cta: false,
    }),
    email,
  );
  return reply;
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
  if (!raw)
    throw new Error("Email verification expired. Please verify again.");
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
  var date = text_(p.date, 30),
    quarter = text_(p.quarter, 30);
  // The reporting year is read back off this column by both this file and the
  // portal, so it has to be stored in a shape that always carries one.
  if (QUARTERS.indexOf(quarter) < 0)
    throw new Error("Select a reporting quarter from the list.");
  if (num_(p.participants) > MAX_PARTICIPANTS)
    throw new Error("Check the total participants figure.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
    throw new Error("Enter the consultation date as YYYY-MM-DD.");
  if (
    date >
    Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd")
  )
    throw new Error("The consultation date cannot be in the future.");
  var year = date.slice(0, 4);
  // Everything the office actually wrote, checked for length up front. Doing it
  // here rather than while building the row means an over-long narrative is
  // refused before saveReportFiles_() has created a folder in Drive to orphan.
  var notes = p.notes || {},
    record = {
      initiatives: field_(
        notes.initiatives,
        5000,
        "CHED initiatives, programs and policies",
      ),
      student: field_(notes.student, 5000, "Student welfare concerns"),
      academic: field_(notes.academic, 5000, "Curriculum and academic programs"),
      governance: field_(notes.governance, 5000, "HEI governance concerns"),
      regionConcerns: field_(p.regionConcerns, 5000, "Region-specific concerns"),
      otherMatters: field_(p.otherMatters, 5000, "Other matters"),
      presidedBy: field_(p.presidedBy, 300, "Presided by"),
      rapporteur: field_(p.rapporteur, 300, "Rapporteur"),
      certifiedBy: field_(p.certifiedBy, 300, "Certified correct by"),
      notedBy: field_(p.notedBy, 300, "Noted by"),
    };
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var sh = sheet_("Dialogue Reports", headers_()),
      h = headers_(),
      sIdx = h.indexOf("Status"),
      rIdx = h.indexOf("Admin_Remarks"),
      v = sh.getDataRange().getValues(),
      supersede = 0;
    // One live report per office per quarter. A report the Central Office has
    // returned is the one case where a replacement is expected, so that row is
    // superseded by the new one instead of sitting alongside it - otherwise the
    // office stays flagged for revision forever and every count reads double.
    // Anything else has to be returned for revision before it can be replaced.
    for (var i = 1; i < v.length; i++) {
      if (
        String(v[i][2]) !== user.region ||
        String(v[i][3]) !== quarter ||
        year_(v[i][4], v[i][0]) !== year
      )
        continue;
      var prior = String(v[i][sIdx] || "For review");
      if (prior === SUPERSEDED) continue;
      if (prior !== "Needs revision")
        throw new Error(
          "A " +
            quarter +
            " " +
            year +
            " report (" +
            v[i][1] +
            ") is already on file for " +
            user.region +
            " and is marked “" +
            prior +
            "”. Ask Central Office to return it for revision before " +
            "filing a replacement.",
        );
      supersede = i;
    }
    var id =
      "CDR-" +
      Utilities.formatDate(
        new Date(),
        Session.getScriptTimeZone(),
        "yyyyMMdd",
      ) +
      "-" +
      String(sh.getLastRow()).padStart(4, "0");
    var files = saveReportFiles_(id, user, p.attendanceFile, p.photoFiles),
      row = [
        new Date(),
        id,
        text_(p.region, 80),
        quarter,
        date,
        num_(p.participants),
        record.initiatives,
        record.student,
        record.academic,
        record.governance,
        record.regionConcerns,
        record.otherMatters,
        files.attendanceUrl,
        files.photoUrls.join("\n"),
        record.presidedBy,
        record.rapporteur,
        record.certifiedBy,
        record.notedBy,
        user.email,
        user.name,
        user.role,
        "For review",
        "",
      ];
    sh.appendRow(row);
    // Only after the replacement is safely on the sheet, so a failure above
    // never leaves the office with no live report for the quarter.
    var replaced = "";
    if (supersede) {
      replaced = String(v[supersede][1]);
      sh.getRange(supersede + 1, sIdx + 1).setValue(SUPERSEDED);
      sh.getRange(supersede + 1, rIdx + 1).setValue(
        text_(
          (String(v[supersede][rIdx] || "") + " ").trim() +
            " [Replaced by " +
            id +
            " on " +
            stamp_() +
            "]",
          2000,
        ),
      );
    }
    var auditWarning = tryAudit_(
      "dialogue_submitted",
      id,
      user.email,
      p.region + (replaced ? " (replaces " + replaced + ")" : ""),
    );
    var warning = [files.warning, auditWarning].filter(String).join(" ");
    return out_({
      ok: true,
      submissionId: id,
      replaced: replaced,
      warning: warning,
      message:
        "Consultation report submitted." +
        (replaced ? " It replaces " + replaced + "." : "") +
        (warning ? " " + warning : ""),
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
    var out = {
      attendanceUrl: save(attendance, "Attendance"),
      photoUrls: photos.map(function (f, i) {
        return save(f, "Photo " + (i + 1));
      }),
      warning: "",
    };
    // Files inherit the report folder, so the folder is what gets shared. Left
    // unshared they are owned by the script account alone, and every link the
    // portal shows a reviewer opens on a "Request access" page.
    out.warning = shareReportFolder_(folder, user.region);
    return out;
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
/**
 * Make one report's attachments openable by the people who have to read them.
 * Never throws: the report itself matters more than the link, so a sharing
 * problem comes back as a warning the submitter and the audit log both see.
 *
 * ATTACHMENT_SHARING script property:
 *   "domain" (default) anyone signed in to ALLOWED_EMAIL_DOMAIN who holds the
 *                      link. Right when ched.gov.ph is a Google Workspace
 *                      domain, and keeps student data inside it.
 *   "anyone"           anyone at all who holds the link. For deployments whose
 *                      owner is not on a Workspace domain, where "domain" is
 *                      unavailable. Attendance sheets carry student names, so
 *                      pick this only deliberately.
 *   "private"          share nothing - the behaviour before this existed.
 *                      Links will open for the script owner and nobody else.
 */
function shareReportFolder_(folder, region) {
  try {
    var mode = config_().attachmentSharing;
    if (mode === "private") return "";
    folder.setSharing(
      mode === "anyone"
        ? DriveApp.Access.ANYONE_WITH_LINK
        : DriveApp.Access.DOMAIN_WITH_LINK,
      DriveApp.Permission.VIEW,
    );
    return "";
  } catch (err) {
    // DOMAIN_WITH_LINK is rejected when the owning account is not on a
    // Workspace domain. Naming the reviewers individually still gets the
    // attachments open for everyone who exists right now.
    var named = grantReportViewers_(folder, region),
      why = err && err.message ? err.message : String(err);
    tryAudit_("attachment_sharing_failed", "", "", folder.getName() + " / " + why);
    return named
      ? "Attachment links were shared with " +
          named +
          " named reviewers; portal-wide link sharing is unavailable on this " +
          "Drive account."
      : "Attachment links could not be shared, so reviewers may not be able " +
          "to open them. Ask the portal administrator to check " +
          "ATTACHMENT_SHARING.";
  }
}
/** Fallback viewer list: every Central Office account plus the approved users
 * of the submitting office. Exact, but frozen at the moment of submission - an
 * officer approved later does not inherit access to older folders, which is
 * why link-based sharing is the preferred mode above. Returns how many. */
function grantReportViewers_(folder, region) {
  try {
    var v = sheet_("Users", usersHeaders_()).getDataRange().getValues(),
      map = {},
      emails = [];
    v[0].forEach(function (x, i) {
      map[x] = i;
    });
    for (var i = 1; i < v.length; i++) {
      if (String(v[i][map.Account_Status]) !== "Approved") continue;
      if (
        String(v[i][map.Role]).indexOf("central") !== 0 &&
        String(v[i][map.Region]) !== region
      )
        continue;
      var e = email_(v[i][map.Email]);
      if (e) emails.push(e);
    }
    if (emails.length) folder.addViewers(emails);
    return emails.length;
  } catch (err) {
    return 0;
  }
}
/** One-off maintenance. Applies the configured sharing to every report folder
 * already in Drive, so attachments filed before this existed start opening for
 * reviewers too. Safe to re-run. */
function repairAttachmentSharing() {
  var cfg = config_();
  if (!cfg.driveFolderId) throw new Error("DRIVE_FOLDER_ID is not configured.");
  var it = DriveApp.getFolderById(cfg.driveFolderId).getFolders(),
    ok = 0,
    warned = 0;
  while (it.hasNext()) {
    var f = it.next(),
      name = f.getName(),
      // Report folders are named "<reference> - <region>".
      region = name.indexOf(" - ") > -1 ? name.split(" - ").slice(1).join(" - ") : "";
    if (shareReportFolder_(f, region)) warned++;
    else ok++;
  }
  Logger.log(
    "Attachment sharing applied to " +
      ok +
      " folder(s). " +
      warned +
      " could not be shared as configured.",
  );
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
  var c = CacheService.getScriptCache(),
    key = windowKey_("lf_" + hash_(email), LOGIN_WINDOW),
    locked = "Too many sign-in attempts for this account. Please wait a few " +
      "minutes and try again, or reset your password.";
  if (Number(c.get(key) || 0) >= LOGIN_MAX_FAILURES) throw new Error(locked);
  /** Count a credential failure and stop. Only the attempt that crosses the
   * threshold is written to the audit log: every failure would let an
   * unauthenticated caller append rows to the sheet at will, and one row per
   * account per window is enough to see a guessing run in the log. */
  function reject_(reason) {
    if (bump_(key, LOGIN_WINDOW) === LOGIN_MAX_FAILURES)
      // Best-effort: a failing audit write must not replace the credential
      // error with a sheet error, which would both confuse the user and leak
      // backend detail to an unauthenticated caller.
      tryAudit_(
        "login_blocked",
        "",
        email,
        LOGIN_MAX_FAILURES + " failed attempts (" + reason + ")",
      );
    throw new Error("Invalid credentials or inactive account.");
  }
  var found = findAccount_(email);
  // These two test no password, so they are not guessable and are not counted.
  // They do disclose that an account exists; narrowing that is a separate change.
  if (found && found.row.Account_Status === "Invited")
    throw new Error(
      "Your account has not been set up yet. Open the invitation email from Central Office to choose a password.",
    );
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
    reject_("no approved account");
  if (pwHash_(password, found.row.Password_Salt) !== found.row.Password_Hash)
    reject_("wrong password");
  c.remove(key);
  found.sheet
    .getRange(found.index + 1, found.map.Last_Login + 1)
    .setValue(new Date());
  var user = {
    email: email,
    name: found.row.Display_Name,
    role: found.row.Role,
    region: found.row.Region,
    // Compared against the account's revocation stamp on every request.
    issued: new Date().getTime(),
  };
  var token = Utilities.getUuid() + Utilities.getUuid();
  CacheService.getScriptCache().put(
    "account_" + token,
    JSON.stringify(user),
    SESSION_TTL,
  );
  tryAudit_("account_login", "", email, user.region);
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
    name = field_(p.name, 200, "Full name"),
    region = text_(p.region, 80);
  if (!email || !name || REGIONS.indexOf(region) < 0)
    throw new Error(
      "Enter your name, official email and CHED Regional Office.",
    );
  domain_(email, config_());
  if (password.length < 12)
    throw new Error("Use a password of at least 12 characters.");
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    // Inside the lock, so two simultaneous registrations for the same address
    // cannot both pass this check and append a row each.
    var existing = findAccount_(email);
    if (existing && !reclaimable_(existing))
      throw new Error("An account request already exists for this email.");
    var salt = Utilities.getUuid(),
      row = [
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
      ];
    if (existing) writeRow_(existing, row);
    else sheet_("Users", usersHeaders_()).appendRow(row);
  } finally {
    lock.releaseLock();
  }
  tryAudit_("account_requested", "", email, region);
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
  // Approving an invitation would mark it Active and Approved while it still
  // has no password: the account would show as usable, refuse every sign-in,
  // and its invitation would read as already used. Invitations are managed by
  // resending or revoking them, never through this action.
  if (f.row.Account_Status === "Invited")
    throw new Error(
      "This account has an outstanding invitation. Resend or revoke it instead.",
    );
  if (approve && !f.row.Password_Hash)
    throw new Error(
      "This account has no password set, so it cannot be approved.",
    );
  f.sheet.getRange(f.index + 1, f.map.Active + 1).setValue(approve);
  f.sheet
    .getRange(f.index + 1, f.map.Account_Status + 1)
    .setValue(approve ? "Approved" : "Rejected");
  // A rejected account must stop working now, not in up to two hours' time.
  revoke_(email);
  tryAudit_(
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
      PORTAL_NAME + ": " + (approve ? "Account approved" : "Account request reviewed"),
      approve
        ? emailBody_({
            heading: "Your portal account has been approved",
            intro:
              "Central Office has verified your registration. You can now sign in and file Consultation and Dialogue Reports for your regional office.",
            details: [
              ["Name", f.row.Display_Name],
              ["Regional office", f.row.Region],
              ["Sign in with", email],
              ["Approved", stamp_()],
            ],
            callout: {
              title: "Reporting requirement",
              body:
                "One Consultation and Dialogue Report (Annex A) is required each quarter, with the attendance sheet and photo documentation attached.",
            },
            next:
              "Your regional office is locked to this account and is applied automatically to every report you submit. If the office shown above is not correct, contact Central Office before filing anything.",
          })
        : emailBody_({
            heading: "Your portal account request was not approved",
            intro:
              "Central Office has reviewed your registration and was unable to approve it.",
            details: [
              ["Name", f.row.Display_Name],
              ["Office requested", f.row.Region],
              ["Email", email],
              ["Reviewed", stamp_()],
            ],
            next:
              "This usually means the regional office selected did not match our records. Contact Central Office to confirm your assignment, then register again with the correct office.",
            cta: false,
          }),
      admin.email,
    );
  return out_({
    ok: true,
    notified: notice.sent,
    message: notice.sent ? decision : decision + " " + notice.warning,
  });
}
/** Send a notification without letting a mail failure undo work already
 * committed to the sheet. Returns whether it went out.
 * `content` is the { html, text } pair produced by emailBody_(). */
function notify_(to, subject, content, actorEmail) {
  try {
    MailApp.sendEmail({
      to: to,
      subject: subject,
      body: content.text,
      htmlBody: content.html,
    });
    return { sent: true, warning: "" };
  } catch (mailErr) {
    var reason = mailErr && mailErr.message ? mailErr.message : String(mailErr);
    // The audit write is best-effort too: letting it throw here would undo the
    // very guarantee this helper exists to provide.
    tryAudit_("notification_failed", "", actorEmail || "", to + " / " + reason);
    return {
      sent: false,
      warning:
        "The notification email to " + to + " could not be sent: " + reason,
    };
  }
}
/** Every value interpolated into the HTML email body passes through this, and
 * nothing else stands between stored text and that markup - input is no longer
 * stripped of angle brackets on the way in, because doing so corrupted the
 * reports it was meant to protect. Miss a call here and you have an injection.
 * The plain-text half of emailBody_() needs no escaping. */
function esc_(v) {
  return String(v == null ? "" : v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
function portalUrl_() {
  return (
    PropertiesService.getScriptProperties().getProperty("PORTAL_URL") ||
    "https://ched-consultation-reporting-portal.vercel.app/"
  );
}
function stamp_() {
  return Utilities.formatDate(
    new Date(),
    Session.getScriptTimeZone(),
    "d MMMM yyyy 'at' h:mm a",
  );
}
/**
 * Shared shell for every portal notification, returning { html, text } so
 * recipients on plain-text clients get a readable message too.
 *
 * o.heading  short title line
 * o.intro    one sentence of context (plain text)
 * o.details  [[label, value], ...] summary rows; blank values are dropped
 * o.code     optional large verification code
 * o.callout  optional { title, body, tone: "warn" | "info" } highlighted block
 * o.next     what the recipient should do (plain text)
 * o.cta      whether to show the "Open the portal" button
 */
function emailBody_(o) {
  var url = portalUrl_(),
    details = (o.details || []).filter(function (d) {
      return d[1] !== "" && d[1] != null;
    }),
    warn = o.callout && o.callout.tone === "warn",
    rows = details
      .map(function (d) {
        return (
          '<tr><td style="padding:5px 18px 5px 0;color:#5b6675;font-size:13px;' +
          'vertical-align:top;white-space:nowrap">' +
          esc_(d[0]) +
          '</td><td style="padding:5px 0;color:#172036;font-size:13px;' +
          'font-weight:600">' +
          esc_(d[1]) +
          "</td></tr>"
        );
      })
      .join("");
  var html =
    '<div style="font-family:Arial,Helvetica,sans-serif;color:#172036;' +
    'max-width:560px;line-height:1.6">' +
    '<p style="margin:0 0 4px;font-size:11px;letter-spacing:.08em;' +
    'text-transform:uppercase;color:#5b6675">' +
    esc_(PORTAL_NAME) +
    "</p>" +
    '<h2 style="margin:0 0 14px;font-size:18px;color:#102b54">' +
    esc_(o.heading) +
    "</h2>" +
    '<p style="margin:0 0 16px;font-size:14px">' +
    esc_(o.intro) +
    "</p>" +
    (rows
      ? '<table style="border-collapse:collapse;margin:0 0 18px">' +
        rows +
        "</table>"
      : "") +
    (o.code
      ? '<p style="margin:0 0 18px;font-size:30px;font-weight:700;' +
        'letter-spacing:8px;color:#102b54">' +
        esc_(o.code) +
        "</p>"
      : "") +
    (o.callout
      ? '<div style="border-left:3px solid ' +
        (warn ? "#c9553d" : "#2e609d") +
        ";background:" +
        (warn ? "#fdf3f1" : "#f1f6fc") +
        ';padding:12px 14px;margin:0 0 18px">' +
        '<p style="margin:0 0 5px;font-size:12px;font-weight:700;color:' +
        (warn ? "#8d3226" : "#245d9c") +
        '">' +
        esc_(o.callout.title) +
        '</p><p style="margin:0;font-size:13px;color:' +
        (warn ? "#5a2b22" : "#22314a") +
        '">' +
        esc_(o.callout.body) +
        "</p></div>"
      : "") +
    (o.next
      ? '<p style="margin:0 0 20px;font-size:14px">' + esc_(o.next) + "</p>"
      : "") +
    // o.link overrides the generic button with a specific destination, which is
    // what an invitation needs: the portal is no use to the recipient until
    // they have followed the token in this link.
    (o.link
      ? '<p style="margin:0 0 22px"><a href="' +
        esc_(o.link.url) +
        '" style="background:#102b54;color:#ffffff;text-decoration:none;' +
        'font-size:13px;font-weight:700;padding:11px 20px;border-radius:6px;' +
        'display:inline-block">' +
        esc_(o.link.label) +
        "</a></p>"
      : o.cta === false
        ? ""
        : '<p style="margin:0 0 22px"><a href="' +
          esc_(url) +
          '" style="background:#102b54;color:#ffffff;text-decoration:none;' +
          'font-size:13px;font-weight:700;padding:11px 20px;border-radius:6px;' +
          'display:inline-block">Open the portal</a></p>') +
    '<p style="margin:0;font-size:11px;color:#7d8795">Automated message from ' +
    "the " +
    esc_(PORTAL_NAME) +
    ". Please do not reply to this email.</p></div>";
  var lines = [PORTAL_NAME.toUpperCase(), "", o.heading, "", o.intro, ""];
  details.forEach(function (d) {
    lines.push("  " + d[0] + ": " + d[1]);
  });
  if (details.length) lines.push("");
  if (o.code) lines.push("  " + o.code, "");
  if (o.callout) lines.push(o.callout.title, o.callout.body, "");
  if (o.next) lines.push(o.next, "");
  // The plain-text half has to carry the link too, or a recipient on a text
  // client has no way to accept an invitation at all.
  if (o.link) lines.push(o.link.label + ":", o.link.url, "");
  else if (o.cta !== false) lines.push(url, "");
  lines.push(
    "Automated message from the " + PORTAL_NAME + ". Please do not reply.",
  );
  return { html: html, text: lines.join("\n") };
}
// ---- Central Office invitations --------------------------------------------
/**
 * Create an account from Central Office and email the person an invitation.
 *
 * The invitee sets their own password. An administrator who types a colleague's
 * first password knows it, which defeats the point of hashing every password in
 * the sheet and makes the audit trail unreliable, since actions attributed to
 * that user are no longer provably theirs. The Users sheet has carried
 * Invite_Hash and Invite_Expires from the start for exactly this.
 */
function inviteAccount_(p) {
  var admin = accountSession_(p.accountToken, ["central_admin"]),
    email = email_(p.email),
    name = field_(p.name, 200, "Full name"),
    role = text_(p.role, 40) || "chedro_user",
    region = role === "central_admin" ? CENTRAL_OFFICE : text_(p.region, 80);
  if (role !== "chedro_user" && role !== "central_admin")
    throw new Error("Choose a portal role for this account.");
  if (!email || !name)
    throw new Error("Enter the name and official email address.");
  if (role === "chedro_user" && REGIONS.indexOf(region) < 0)
    throw new Error("Select the CHED Regional Office for this account.");
  domain_(email, config_());
  var token = Utilities.getUuid() + Utilities.getUuid(),
    expires = new Date().getTime() + INVITE_TTL_DAYS * 86400000,
    lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var existing = findAccount_(email);
    if (existing && !reclaimable_(existing))
      throw new Error("An account already exists for this email address.");
    var row = [
      email,
      "",
      "",
      name,
      role,
      region,
      false,
      "Invited",
      sign_("invite:" + token),
      expires,
      new Date(),
      "",
    ];
    if (existing) writeRow_(existing, row);
    else sheet_("Users", usersHeaders_()).appendRow(row);
  } finally {
    lock.releaseLock();
  }
  tryAudit_(
    role === "central_admin" ? "admin_invited" : "account_invited",
    "",
    admin.email,
    email + " / " + region,
  );
  var notice = sendInvite_(email, name, role, region, token, admin.email);
  // Minting another administrator widens who can mint administrators, so the
  // people who already hold that power are told it happened. Best-effort: the
  // account row is already written, and letting this throw would report a
  // completed invitation as a failure the admin would then retry.
  if (role === "central_admin")
    try {
      notifyAdminsOfNewAdmin_(email, name, admin.email);
    } catch (notifyErr) {
      tryAudit_(
        "admin_notice_failed",
        "",
        admin.email,
        email + " / " + (notifyErr && notifyErr.message),
      );
    }
  return out_({
    ok: true,
    email: email,
    notified: notice.sent,
    message: notice.sent
      ? "Invitation sent to " + email + "."
      : "Account created, but the invitation email failed: " + notice.warning,
  });
}
/** Issue a fresh token for an outstanding invitation and send it again. */
function resendInvite_(p) {
  var admin = accountSession_(p.accountToken, ["central_admin"]),
    email = email_(p.email),
    f = findAccount_(email);
  if (!f || f.row.Account_Status !== "Invited")
    throw new Error("No outstanding invitation for this email address.");
  var token = Utilities.getUuid() + Utilities.getUuid(),
    expires = new Date().getTime() + INVITE_TTL_DAYS * 86400000;
  // Writing the new token retires the old one, so an invitation that was
  // forwarded or intercepted stops working the moment it is resent.
  f.sheet
    .getRange(f.index + 1, f.map.Invite_Hash + 1)
    .setValue(sign_("invite:" + token));
  f.sheet.getRange(f.index + 1, f.map.Invite_Expires + 1).setValue(expires);
  tryAudit_("invite_resent", "", admin.email, email);
  var notice = sendInvite_(
    email,
    f.row.Display_Name,
    f.row.Role,
    f.row.Region,
    token,
    admin.email,
  );
  return out_({
    ok: true,
    notified: notice.sent,
    message: notice.sent
      ? "Invitation resent to " + email + "."
      : "A new invitation was issued but could not be emailed: " +
        notice.warning,
  });
}
/** Withdraw an invitation that has not been accepted. */
function revokeInvite_(p) {
  var admin = accountSession_(p.accountToken, ["central_admin"]),
    email = email_(p.email),
    f = findAccount_(email);
  if (!f || f.row.Account_Status !== "Invited")
    throw new Error("No outstanding invitation for this email address.");
  f.sheet.getRange(f.index + 1, f.map.Account_Status + 1).setValue("Rejected");
  f.sheet.getRange(f.index + 1, f.map.Invite_Hash + 1).setValue("");
  f.sheet.getRange(f.index + 1, f.map.Invite_Expires + 1).setValue("");
  tryAudit_("invite_revoked", "", admin.email, email);
  return out_({ ok: true, message: "Invitation withdrawn." });
}
/** Look up an invitation by its token so the acceptance screen can name who it
 * is for. The token is the secret and only the invitee holds it, so returning
 * the address it was sent to discloses nothing they do not already know. */
function inviteDetails_(p) {
  var f = findInvite_(p.inviteToken);
  return out_({
    ok: true,
    email: f.row.Email,
    name: f.row.Display_Name,
    role: f.row.Role,
    region: f.row.Region,
  });
}
/** Accept an invitation: the invitee sets the first password on the account. */
function acceptInvite_(p) {
  var password = String(p.password || "");
  if (password.length < 12)
    throw new Error("Use a password of at least 12 characters.");
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    return acceptInviteLocked_(p, password);
  } finally {
    lock.releaseLock();
  }
}
/** Held under the script lock so two clicks on the same link cannot both find
 * the invitation live and race to set different passwords on the account. */
function acceptInviteLocked_(p, password) {
  var f = findInvite_(p.inviteToken),
    email = email_(f.row.Email),
    salt = Utilities.getUuid();
  f.sheet.getRange(f.index + 1, f.map.Password_Salt + 1).setValue(salt);
  f.sheet
    .getRange(f.index + 1, f.map.Password_Hash + 1)
    .setValue(pwHash_(password, salt));
  f.sheet.getRange(f.index + 1, f.map.Account_Status + 1).setValue("Approved");
  f.sheet.getRange(f.index + 1, f.map.Active + 1).setValue(true);
  // Single use: the token is spent whether or not the tab stays open.
  f.sheet.getRange(f.index + 1, f.map.Invite_Hash + 1).setValue("");
  f.sheet.getRange(f.index + 1, f.map.Invite_Expires + 1).setValue("");
  tryAudit_("invite_accepted", "", email, f.row.Region);
  return out_({
    ok: true,
    email: email,
    message: "Your account is ready. You can now sign in.",
  });
}
/** The row an invitation token belongs to, or a refusal. Matched on the signed
 * token rather than on an email supplied beside it, so a caller cannot point
 * someone else's token at a row of their choosing. */
function findInvite_(token) {
  var t = text_(token, 120);
  if (!t) throw new Error("This invitation link is not valid.");
  var wanted = sign_("invite:" + t),
    sh = sheet_("Users", usersHeaders_()),
    v = sh.getDataRange().getValues(),
    h = v[0],
    map = {};
  h.forEach(function (x, i) {
    map[x] = i;
  });
  for (var i = 1; i < v.length; i++) {
    if (!v[i][map.Invite_Hash] || String(v[i][map.Invite_Hash]) !== wanted)
      continue;
    if (String(v[i][map.Account_Status]) !== "Invited")
      throw new Error("This invitation has already been used.");
    if (Number(v[i][map.Invite_Expires]) < new Date().getTime())
      throw new Error(
        "This invitation has expired. Ask Central Office to send a new one.",
      );
    var row = {};
    h.forEach(function (x, j) {
      row[x] = v[i][j];
    });
    return { sheet: sh, index: i, map: map, row: row };
  }
  throw new Error("This invitation link is not valid.");
}
/** Send one invitation. Counted against the same hourly mail ceiling as the
 * reset codes, so a runaway client cannot drain the daily quota through here. */
function sendInvite_(email, name, role, region, token, actorEmail) {
  if (
    bump_(windowKey_("otpmail", OTP_GLOBAL_WINDOW), OTP_GLOBAL_WINDOW) >
    OTP_GLOBAL_CAP
  ) {
    tryAudit_("otp_quota_blocked", "", actorEmail, "Invitation to " + email);
    return {
      sent: false,
      warning: "the portal has reached its hourly email limit.",
    };
  }
  return notify_(
    email,
    PORTAL_NAME + ": You have been invited to the portal",
    emailBody_({
      heading: "Set up your portal account",
      intro:
        "Central Office has created a portal account for you. Open the link below to choose a password, then sign in.",
      details: [
        ["Name", name],
        ["Sign in with", email],
        [
          role === "central_admin" ? "Role" : "Regional office",
          role === "central_admin" ? "Central Office Administrator" : region,
        ],
        ["Invitation valid for", INVITE_TTL_DAYS + " days"],
      ],
      next:
        "Choose a password of at least 12 characters. If you were not expecting this invitation, ignore this email and tell Central Office.",
      cta: false,
      link: {
        url: portalUrl_() + "?invite=" + encodeURIComponent(token),
        label: "Accept the invitation",
      },
    }),
    actorEmail,
  );
}
/** Every approved Central Office address. */
function adminEmails_() {
  var v = sheet_("Users", usersHeaders_()).getDataRange().getValues(),
    map = {},
    out = [];
  v[0].forEach(function (x, i) {
    map[x] = i;
  });
  for (var i = 1; i < v.length; i++)
    if (
      String(v[i][map.Role]) === "central_admin" &&
      String(v[i][map.Account_Status]) === "Approved"
    ) {
      var e = email_(v[i][map.Email]);
      if (e) out.push(e);
    }
  return out;
}
/** Tell the existing administrators that another one now exists. */
function notifyAdminsOfNewAdmin_(email, name, actorEmail) {
  adminEmails_().forEach(function (to) {
    if (to === email) return;
    notify_(
      to,
      PORTAL_NAME + ": A new Central Office administrator was invited",
      emailBody_({
        heading: "A new administrator has been invited",
        intro:
          "Someone with Central Office access has invited another administrator. Administrators can read every report and invite further accounts, so this notice goes to all of them.",
        details: [
          ["New administrator", name],
          ["Email", email],
          ["Invited by", actorEmail],
          ["When", stamp_()],
        ],
        next:
          "If you did not expect this, speak to the other administrators before the invitation is accepted. It can be withdrawn from User access.",
        cta: false,
      }),
      actorEmail,
    );
  });
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
  // A reset is the standard response to a compromise, so any session already
  // open on this account has to end with it.
  revoke_(verified.email);
  // The verification token is spent: without this it stays valid for the rest
  // of the session window and could reset the password again.
  CacheService.getScriptCache().remove(
    "session_" + text_(p.otpSessionToken, 100),
  );
  tryAudit_("password_reset", "", verified.email, f.row.Region);
  return out_({ ok: true, message: "Password updated. You may now sign in." });
}
/**
 * Sessions live in the script cache, which cannot be enumerated, so they can
 * not be deleted one by one when an account changes underneath them. Instead
 * each session records when it was issued and each account can carry a
 * revocation stamp; anything issued before the stamp is refused. One extra
 * cache read per request, and no trip to the Users sheet.
 *
 * This catches the state changes the portal itself makes - rejection and
 * password reset. An administrator editing the Users sheet by hand is not
 * seen until the session expires on its own.
 */
function revoke_(email) {
  CacheService.getScriptCache().put(
    "rev_" + hash_(email_(email)),
    String(new Date().getTime()),
    // Outlives any session that could still be holding a stale view.
    SESSION_TTL,
  );
}
function accountSession_(token, roles) {
  var c = CacheService.getScriptCache(),
    raw = c.get("account_" + text_(token, 100));
  if (!raw) throw authError_("Your session expired. Please sign in again.");
  var u = JSON.parse(raw),
    revoked = c.get("rev_" + hash_(u.email));
  if (revoked && Number(revoked) > Number(u.issued || 0))
    throw authError_(
      "Your access changed and this session has ended. Please sign in again.",
    );
  if (roles && roles.indexOf(u.role) < 0)
    throw new Error("You do not have permission for this action.");
  return u;
}
/** Marks an error as "the caller's session is no longer usable", so doPost can
 * pass a code the portal recognises and bounce the user to sign-in instead of
 * leaving them on a page that will fail every request from here on. */
function authError_(message) {
  var e = new Error(message);
  e.code = "SESSION";
  return e;
}
/** Overwrite an existing Users row in one call. */
function writeRow_(f, row) {
  f.sheet.getRange(f.index + 1, 1, 1, row.length).setValues([row]);
}
/**
 * A rejected account still occupies its email address. Without this the portal
 * contradicts itself: the rejection email tells the applicant to "register
 * again with the correct office", and registration then refuses because a row
 * already exists. The same trap catches an administrator who revokes an
 * invitation and wants to reissue it. Rejected rows are therefore reusable -
 * the row is rewritten rather than a second one appended.
 */
function reclaimable_(f) {
  return !!f && String(f.row.Account_Status) === "Rejected";
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
/**
 * OTP_SECRET does double duty: it signs verification codes and peppers every
 * password hash. When it is missing, config_() hands back null and the pepper
 * silently becomes the literal string "null" - a publicly known key, with no
 * visible symptom. Both callers go through here so that cannot happen quietly.
 *
 * It also means OTP_SECRET must never be rotated once accounts exist: changing
 * it invalidates every stored password at the same moment.
 */
function secret_() {
  var s = config_().secret;
  if (!s)
    throw new Error(
      "OTP_SECRET is not configured. Run setupPortal() before creating accounts.",
    );
  return s;
}
function pwHash_(password, salt) {
  var out = String(password) + ":" + salt,
    secret = secret_() + ":" + salt;
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
    remarks = field_(p.remarks, 2000, "Remarks"),
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
        // A superseded row is the historical copy of a report the office has
        // already replaced; reviewing it would email remarks about a version
        // nobody is working from any more.
        if (String(v[i][statusCol - 1]) === SUPERSEDED)
          throw new Error(
            "Report " +
              reference +
              " was replaced by a later submission and can no longer be reviewed.",
          );
        sh.getRange(i + 1, statusCol).setValue(status);
        sh.getRange(i + 1, remarksCol).setValue(remarks);
        tryAudit_(
          "submission_reviewed",
          reference,
          admin.email,
          status + (remarks ? " / " + remarks : ""),
        );
        var recipient = email_(v[i][18]),
          revised = status === "Needs revision",
          notice = { sent: true, warning: "" };
        if (recipient && status !== "For review")
          notice = notify_(
            recipient,
            PORTAL_NAME +
              ": " +
              (revised
                ? "Report returned for revision"
                : "Report validated") +
              " (" +
              reference +
              ")",
            emailBody_({
              heading: revised
                ? "Consultation report returned for revision"
                : "Consultation report validated",
              intro: revised
                ? "Central Office has reviewed the report below and is asking your office to correct it."
                : "Central Office has reviewed and validated the report below.",
              details: [
                ["Reference", reference],
                ["Regional office", v[i][2]],
                ["Quarter", v[i][3]],
                ["Consultation date", v[i][4]],
                ["Participants", v[i][5]],
                ["Submitted by", v[i][19]],
                ["Status", status],
                ["Reviewed", stamp_()],
              ],
              callout: remarks
                ? {
                    title: revised
                      ? "What needs to be corrected"
                      : "Remarks from Central Office",
                    body: remarks,
                    tone: revised ? "warn" : "info",
                  }
                : null,
              next: revised
                ? "Sign in to read the remarks in full, then submit a corrected report for this quarter."
                : "No further action is required for this quarter.",
            }),
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
/** audit_() for use *after* the work is already on the sheet. A failing log
 * write must not turn a committed change into an error the caller will retry -
 * that is how one submitted report becomes two. Returns a warning to pass on
 * where the response has somewhere to put one, empty when the row went in. */
function tryAudit_(action, ref, email, detail) {
  try {
    audit_(action, ref, email, detail);
    return "";
  } catch (err) {
    return (
      "The action succeeded but could not be written to the audit log: " +
      (err && err.message ? err.message : String(err))
    );
  }
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
    attachmentSharing: String(
      p.getProperty("ATTACHMENT_SHARING") || "domain",
    ).toLowerCase(),
  };
}
function domain_(e, c) {
  if (c.domain && e.split("@")[1] !== c.domain)
    throw new Error("Please use your @" + c.domain + " email address.");
}
function sign_(s) {
  return Utilities.base64EncodeWebSafe(
    Utilities.computeHmacSha256Signature(String(s), secret_()),
  );
}
function hash_(s) {
  return Utilities.base64EncodeWebSafe(
    Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s),
  ).slice(0, 28);
}
/** Key for a fixed-window counter. The window is derived from the wall clock
 * rather than from the first hit, so it always drains on its own. A sliding
 * window would be tighter, but it would also let anyone hold a colleague's
 * account shut indefinitely just by continuing to guess at it. */
/** Reporting year of a stored row: the consultation date when it carries a
 * four-digit year, otherwise the submission timestamp. Mirrors yearOf() in the
 * portal, so a report is filed under the same year on both sides. Values come
 * back from the sheet as Date objects or as text depending on how Sheets chose
 * to parse them, so both are handled. */
function year_(date, timestamp) {
  if (date instanceof Date) return String(date.getFullYear());
  var m = String(date == null ? "" : date).match(/(?:19|20)\d{2}/);
  if (m) return m[0];
  if (timestamp instanceof Date) return String(timestamp.getFullYear());
  m = String(timestamp == null ? "" : timestamp).match(/(?:19|20)\d{2}/);
  return m ? m[0] : "";
}
function windowKey_(prefix, windowSec) {
  return prefix + "_" + Math.floor(new Date().getTime() / (windowSec * 1000));
}
/** Increment a cache counter and return the new value. CacheService has no
 * atomic increment, so simultaneous callers can undercount by a few; that is
 * acceptable for a throttle, which only has to stop sustained abuse. Taking a
 * script lock here would be worse than the miscount - it would serialise every
 * sign-in attempt in the portal behind whoever is attacking it. */
function bump_(key, ttl) {
  var c = CacheService.getScriptCache(),
    n = Number(c.get(key) || 0) + 1;
  c.put(key, String(n), ttl);
  return n;
}
function email_(v) {
  var e = text_(v, 254).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : "";
}
/**
 * Normalise a value without altering what it says: drop control characters
 * that would corrupt a sheet cell or a CSV row, and trim. Tab, newline and
 * carriage return are kept.
 *
 * Angle brackets are deliberately left alone. They used to be stripped here as
 * a blanket XSS measure, which quietly rewrote submitted reports - "cohorts of
 * < 30 students" was stored as "cohorts of  30 students", permanently, in an
 * official record. Nothing needed it: the portal renders through JSX and every
 * value interpolated into an email goes through esc_().
 */
function clean_(v) {
  return String(v == null ? "" : v)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim();
}
/** Normalised and truncated. For values whose length is incidental - tokens,
 * file names, and fields already checked against an allowlist. */
function text_(v, n) {
  return clean_(v).slice(0, n || 500);
}
/**
 * Normalised, and refused outright when too long. For anything a person wrote
 * that belongs in the record as they wrote it: silently keeping 5,000 of
 * someone's 6,000 characters loses part of an official report and tells nobody.
 */
function field_(v, n, label) {
  var s = clean_(v);
  if (s.length > n)
    throw new Error(
      label +
        " is " +
        s.length +
        " characters long. Please shorten it to " +
        n +
        " or fewer.",
    );
  return s;
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
