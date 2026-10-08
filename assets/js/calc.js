/* GTA Front Desk missed-call calculator. Pure functions, no network, no cookies.
   Every input is clamped to a sane range; NaN, Infinity and negatives are rejected; the output is capped.
   UMD so Node tests can load it; in a browser it also wires up the #calc inputs. */
(function (root, factory) {
  var C = factory();
  if (typeof module === "object" && module.exports) { module.exports = C; return; }
  root.GTAFDCalc = C;
  if (typeof document !== "undefined") { C.bind(document); }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var LIMITS = {
    calls:  { min: 0, max: 500,   label: "calls per week" },
    missed: { min: 0, max: 100,   label: "% of calls missed" },
    close:  { min: 0, max: 100,   label: "% of answered calls that become jobs" },
    job:    { min: 0, max: 20000, label: "average job value (CAD)" }
  };
  var OUTPUT_CAP = 100000;  // CA$ per month
  var WEEKS_PER_MONTH = 4.33;

  // Parse one raw input. Returns {value, ok, note}; note is "" | "empty" | "invalid" | "negative" | "high".
  function clamp(raw, lim) {
    var s = (raw === null || raw === undefined) ? "" : String(raw).trim();
    if (s === "") { return { value: lim.min, ok: true, note: "empty" }; }
    s = s.replace(/[,$\s]/g, "").replace(/^CA/i, "").replace(/%$/, "");
    if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(s)) { return { value: lim.min, ok: false, note: "invalid" }; }
    var n = Number(s);
    if (!isFinite(n) || isNaN(n)) { return { value: lim.min, ok: false, note: "invalid" }; }
    if (n < lim.min) { return { value: lim.min, ok: false, note: "negative" }; }
    if (n > lim.max) { return { value: lim.max, ok: false, note: "high" }; }
    return { value: n, ok: true, note: "" };
  }
  function fmtNum(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function formatCAD(n) { if (typeof n !== "number" || !isFinite(n) || n < 0) { n = 0; } return "CA$" + fmtNum(n); }
  function message(res, lim) {
    if (res.note === "empty") { return "Empty. Enter a number from " + lim.min + " to " + fmtNum(lim.max) + ". Using " + fmtNum(lim.min) + " for now."; }
    if (res.note === "invalid") { return "That isn't a number. Enter a number from " + lim.min + " to " + fmtNum(lim.max) + ". Using " + fmtNum(lim.min) + " for now."; }
    if (res.note === "negative") { return "Can't be below " + lim.min + ". Using " + lim.min + "."; }
    if (res.note === "high") { return "Capped at " + fmtNum(lim.max) + " so the estimate stays realistic."; }
    return "";
  }
  function round1(n) { return Math.round(n * 10) / 10; }

  // Same formula as the live page: missed calls/week x close rate x job value x 4.33 weeks.
  function trades(input) {
    input = input || {};
    var r = {}, k;
    for (k in LIMITS) { r[k] = clamp(input[k], LIMITS[k]); }
    var missedWeek = r.calls.value * r.missed.value / 100;
    var close = r.close.value / 100;
    var jobs = missedWeek * close * WEEKS_PER_MONTH;
    var lost = jobs * r.job.value;
    var capped = lost > OUTPUT_CAP;
    var shown = capped ? OUTPUT_CAP : lost;
    var warnings = {};
    for (k in r) { var m = message(r[k], LIMITS[k]); if (m) { warnings[k] = m; } }
    return {
      inputs: { calls: r.calls.value, missed: r.missed.value, close: r.close.value, job: r.job.value },
      warnings: warnings, notes: { calls: r.calls.note, missed: r.missed.note, close: r.close.note, job: r.job.note },
      missedWeek: round1(missedWeek), jobs: round1(jobs), monthly: Math.round(shown), capped: capped,
      monthlyText: (capped ? "Over " : "") + formatCAD(shown) + " / month",
      detail: missedWeek.toFixed(1) + " missed calls a week x " + Math.round(close * 100) + "% x " + formatCAD(r.job.value) +
        " x 4.33 weeks = about " + jobs.toFixed(1) + " jobs a month." +
        (capped ? " (Shown capped at CA$100,000 a month. Double-check your numbers.)" : "")
    };
  }

  function bind(doc) {
    var ids = ["calls", "missed", "close", "job"], els = {};
    for (var i = 0; i < ids.length; i++) { els[ids[i]] = doc.getElementById(ids[i]); if (!els[ids[i]]) { return; } }
    var out = doc.getElementById("lost"), detail = doc.getElementById("detail");
    function run() {
      var input = {};
      for (var k in els) { input[k] = (els[k].validity && els[k].validity.badInput) ? "not-a-number" : els[k].value; }
      var r = trades(input);
      for (var f in els) {
        var w = doc.getElementById(f + "-warn"), msg = r.warnings[f] || "";
        if (w) { w.textContent = msg; }
        if (r.notes[f] === "invalid" || r.notes[f] === "negative") { els[f].setAttribute("aria-invalid", "true"); }
        else { els[f].removeAttribute("aria-invalid"); }
      }
      if (out) { out.textContent = r.monthlyText; }
      if (detail) { detail.textContent = r.detail; }
    }
    for (var e in els) { els[e].addEventListener("input", run); }
    run();
  }

  return { LIMITS: LIMITS, OUTPUT_CAP: OUTPUT_CAP, clamp: clamp, formatCAD: formatCAD, trades: trades, bind: bind };
});
