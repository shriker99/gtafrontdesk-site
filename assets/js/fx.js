/* Scroll reveal. IntersectionObserver only: no layout reads (no getBoundingClientRect), so no forced reflow.
   Progressive: without JS, without IntersectionObserver, or with reduced motion, everything is simply visible. */
(function () {
  "use strict";
  if (!("IntersectionObserver" in window)) { return; }
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) { return; }
  var els = document.querySelectorAll("main section > h2, main .card, main details, main .cta");
  if (!els.length) { return; }
  var io = new IntersectionObserver(function (entries) {
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].isIntersecting) { entries[i].target.classList.add("in"); io.unobserve(entries[i].target); }
    }
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
  // Writes only (class names); the observer reports visibility asynchronously, including for elements already on screen.
  for (var i = 0; i < els.length; i++) { els[i].classList.add("reveal"); io.observe(els[i]); }
  document.documentElement.classList.add("js");
})();
