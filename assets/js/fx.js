/* Scroll reveal. Progressive: without JS (or with reduced motion) everything is simply visible. */
(function () {
  "use strict";
  var d = document.documentElement;
  if (!("IntersectionObserver" in window)) { return; }
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) { return; }
  var els = document.querySelectorAll("main section > h2, main .card, main details, main .cta");
  if (!els.length) { return; }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
  Array.prototype.forEach.call(els, function (el, i) {
    el.classList.add("reveal");
    var r = el.getBoundingClientRect();
    if (r.top < window.innerHeight) { el.classList.add("in"); } else { el.style.transitionDelay = (i % 3) * 70 + "ms"; io.observe(el); }
  });
  d.classList.add("js");
})();
