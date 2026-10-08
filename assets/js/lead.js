/* GTA Front Desk callback form. Progressive enhancement over a plain HTML POST to Web3Forms.
   Without JS the browser posts the form (native required/pattern/maxlength) and Web3Forms redirects to /thanks.html.
   With JS: trim + validate, inline errors (aria-describedby), fetch with Accept: application/json, aria-live status.
   UMD so Node tests can load the pure validate(); no cookies, no storage, no third-party scripts. */
(function (root, factory) {
  var L = factory();
  if (typeof module === "object" && module.exports) { module.exports = L; return; }
  root.GTAFDLead = L;
  if (typeof document !== "undefined") {
    if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", function () { L.bind(document, root); }); }
    else { L.bind(document, root); }
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var ENDPOINT = "https://api.web3forms.com/submit";
  var FALLBACK_EMAIL = "hello@gtafrontdesk.ca";
  var TIMEOUT_MS = 15000;
  // Same string as the phone input's pattern attribute (the browser anchors it as ^(?:...)$).
  // Accepts 416-555-0110, (416) 555-0110, 416.555.0110, 416 555 0110, 4165550110, +1 416 555 0110, 1-416-555-0110.
  var PHONE_PATTERN = " *(\\+?1[ .\\-]?)?(\\([2-9][0-9]{2}\\)|[2-9][0-9]{2})[ .\\-]?[2-9][0-9]{2}[ .\\-]?[0-9]{4} *";
  var PHONE_RE = new RegExp("^(?:" + PHONE_PATTERN + ")$");
  var EMAIL_RE = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[^\s@<>()",;:.]{2,}$/;
  var FIELDS = {
    name:     { max: 80,   required: true,  label: "your name" },
    business: { max: 120,  required: false, label: "your business name" },
    phone:    { max: 20,   required: true,  label: "your phone number" },
    email:    { max: 120,  required: false, label: "your email" },
    message:  { max: 1000, required: false, label: "a message" }
  };
  // Control characters (keep tab/newline in the message only).
  var CTRL_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

  function clean(v, multiline) {
    var s = (v === null || v === undefined) ? "" : String(v);
    s = s.replace(CTRL_RE, "");
    if (!multiline) { s = s.replace(/[\r\n\t]+/g, " "); }
    return s.trim();
  }
  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }

  // Pure: raw field values -> { ok, spam, values, errors{field: message} }.
  function validate(raw) {
    raw = raw || {};
    var values = {}, errors = {}, k;
    for (k in FIELDS) {
      var f = FIELDS[k], v = clean(raw[k], k === "message");
      values[k] = v;
      if (f.required && v === "") { errors[k] = "Please enter " + f.label + "."; continue; }
      if (v.length > f.max) { errors[k] = "That's too long. Please keep it under " + fmt(f.max) + " characters."; continue; }
    }
    if (!errors.name && values.name && !/[^\s\d\W_]|[^\u0000-\u007F]/.test(values.name)) { errors.name = "Please enter your name using letters."; }
    if (!errors.phone && values.phone) {
      var digits = values.phone.replace(/\D/g, "");
      if (!PHONE_RE.test(values.phone) || !(digits.length === 10 || (digits.length === 11 && digits.charAt(0) === "1"))) {
        errors.phone = "Please enter a 10-digit phone number, for example 416-555-0110.";
      }
    }
    if (!errors.email && values.email && !EMAIL_RE.test(values.email)) { errors.email = "That email doesn't look right. Check it, or leave it blank."; }
    var spam = !!raw.botcheck && raw.botcheck !== "false";
    var ok = true; for (k in errors) { if (errors.hasOwnProperty(k)) { ok = false; break; } }
    return { ok: ok, spam: spam, values: values, errors: errors };
  }

  // Pure: the JSON body sent by fetch (redirect is for the no-JS path only, per Web3Forms docs).
  function payload(form, values) {
    return {
      access_key: form.access_key, subject: form.subject, from_name: form.from_name, botcheck: false,
      name: values.name, business: values.business, phone: values.phone, email: values.email, message: values.message
    };
  }

  function bind(doc, win) {
    var form = doc.getElementById("cb-form");
    if (!form || !win || typeof win.fetch !== "function") { return; } // no fetch: plain HTML POST still works
    var btn = doc.getElementById("cb-submit"), status = doc.getElementById("cb-status");
    var btnText = btn ? btn.textContent : "";
    var sending = false;
    form.setAttribute("novalidate", "");

    function el(name) { return form.elements[name]; }
    function setStatus(kind, parts) {
      status.className = "cb-status" + (kind === "err" ? " err" : "");
      status.textContent = "";
      var p = doc.createElement("p");
      for (var i = 0; i < parts.length; i++) {
        if (typeof parts[i] === "string") { p.appendChild(doc.createTextNode(parts[i])); }
        else { var a = doc.createElement("a"); a.href = parts[i].href; a.textContent = parts[i].text; p.appendChild(a); }
      }
      status.appendChild(p);
    }
    function showErrors(errors) {
      var first = null;
      for (var k in FIELDS) {
        var input = el(k), err = doc.getElementById("cb-" + k + "-err");
        if (!input || !err) { continue; }
        if (errors[k]) { err.textContent = errors[k]; input.setAttribute("aria-invalid", "true"); if (!first) { first = input; } }
        else { err.textContent = ""; input.removeAttribute("aria-invalid"); }
      }
      return first;
    }
    function fail() {
      setStatus("err", ["Sorry, your request didn't go through. Your details are still in the form, so you can try again, or email us at ",
        { href: "mailto:" + FALLBACK_EMAIL, text: FALLBACK_EMAIL }, "."]);
    }
    function done() { sending = false; if (btn) { btn.disabled = false; btn.textContent = btnText; } form.removeAttribute("aria-busy"); }

    // Clear a field's error as soon as it is fixed.
    form.addEventListener("input", function (e) {
      var t = e.target, k = t && t.name;
      if (!k || !FIELDS[k] || !t.hasAttribute("aria-invalid")) { return; }
      var one = {}; one[k] = t.value; if (k !== "name") { one.name = "x"; } if (k !== "phone") { one.phone = "4165550110"; }
      var r = validate(one); if (!r.errors[k]) { t.removeAttribute("aria-invalid"); var err = doc.getElementById("cb-" + k + "-err"); if (err) { err.textContent = ""; } }
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (sending) { return; }
      var raw = {}; for (var k in FIELDS) { raw[k] = el(k) ? el(k).value : ""; }
      raw.botcheck = el("botcheck") && el("botcheck").checked;
      var r = validate(raw);
      var first = showErrors(r.errors);
      if (!r.ok) { status.textContent = ""; status.className = "cb-status"; if (first) { first.focus(); } return; }
      for (k in FIELDS) { if (el(k)) { el(k).value = r.values[k]; } } // show the trimmed values
      if (r.spam) { form.reset(); setStatus("ok", ["Thanks. We got your request."]); return; } // honeypot: never sent
      sending = true; if (btn) { btn.disabled = true; btn.textContent = "Sending..."; } form.setAttribute("aria-busy", "true");
      setStatus("ok", ["Sending your request..."]);
      var hidden = { access_key: el("access_key").value, subject: el("subject").value, from_name: el("from_name").value };
      var ctrl = (typeof win.AbortController === "function") ? new win.AbortController() : null;
      var timer = win.setTimeout(function () { if (ctrl) { ctrl.abort(); } }, TIMEOUT_MS);
      win.fetch(form.getAttribute("action") || ENDPOINT, {
        method: "POST", headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify(payload(hidden, r.values)), signal: ctrl ? ctrl.signal : undefined
      }).then(function (res) {
        return res.json().then(function (j) { return { ok: res.ok, j: j }; }, function () { return { ok: false, j: null }; });
      }).then(function (out) {
        win.clearTimeout(timer); done();
        if (out.ok && out.j && out.j.success === true) {
          var name = r.values.name, phone = r.values.phone;
          form.reset();
          setStatus("ok", ["Thanks, " + name + ". We got your request and will call you back at " + phone + "."]);
        } else { fail(); }
      }, function () { win.clearTimeout(timer); done(); fail(); });
    });
  }

  return { ENDPOINT: ENDPOINT, FIELDS: FIELDS, PHONE_PATTERN: PHONE_PATTERN, PHONE_RE: PHONE_RE, clean: clean, validate: validate, payload: payload, bind: bind };
});
