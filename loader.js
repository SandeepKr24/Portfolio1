// Intro: types the hero name letter by letter, then flies it into the hero title.
// Plays once per browser session; skipped for reduced motion, deep links and restored scroll.
(function () {
  var KEY = "dcIntroSeen";
  var root = document.documentElement;

  function seen() {
    try { return sessionStorage.getItem(KEY) === "1"; } catch (e) { return false; }
  }
  function markSeen() {
    try { sessionStorage.setItem(KEY, "1"); } catch (e) {}
  }

  var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (seen() || reduced || location.hash) return;
  markSeen();
  root.classList.add("dc-intro", "dc-intro-run");

  var TYPE_MS = 850;   // whole name typed in this time
  var HOLD_MS = 220;   // pause once typed
  var MOVE_MS = 750;   // flight into the hero title
  var overlay, finished = false;

  var blockKeys = { " ": 1, PageDown: 1, PageUp: 1, ArrowDown: 1, ArrowUp: 1, Home: 1, End: 1 };
  function block(e) {
    if (e.type === "keydown" && !blockKeys[e.key]) return;
    e.preventDefault();
    e.stopPropagation();
  }
  window.addEventListener("wheel", block, { capture: true, passive: false });
  window.addEventListener("touchmove", block, { capture: true, passive: false });
  window.addEventListener("keydown", block, true);

  function finish() {
    if (finished) return;
    finished = true;
    window.removeEventListener("wheel", block, { capture: true });
    window.removeEventListener("touchmove", block, { capture: true });
    window.removeEventListener("keydown", block, true);
    root.classList.add("dc-intro-reveal");
    root.classList.remove("dc-intro", "dc-intro-run");
    if (overlay) overlay.remove();
  }
  // Never leave the page covered, whatever goes wrong.
  var safety = setTimeout(finish, 6000);

  function waitFor(test, timeout) {
    return new Promise(function (resolve) {
      var start = performance.now();
      (function tick() {
        var v = test();
        if (v || performance.now() - start > timeout) resolve(v);
        else requestAnimationFrame(tick);
      })();
    });
  }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  function run() {
    overlay = document.createElement("div");
    overlay.id = "dc-intro";
    overlay.setAttribute("aria-hidden", "true");
    overlay.innerHTML = '<div class="dc-intro-bg"></div><div class="dc-intro-name"></div>';
    document.body.appendChild(overlay);
    var bg = overlay.firstChild;
    var nameEl = overlay.lastChild;

    var h1;
    Promise.all([
      waitFor(function () {
        h1 = document.getElementById("hero-title");
        return h1 && h1.textContent.trim() && h1.textContent.indexOf("{{") < 0 ? h1 : null;
      }, 3000),
      document.fonts && document.fonts.ready ? Promise.race([document.fonts.ready, sleep(800)]) : null,
    ]).then(function (res) {
      if (!res[0] || window.scrollY > 0) return finish();

      // Clone the title's typography and box so the text wraps exactly like the real one.
      var cs = getComputedStyle(h1);
      var r = h1.getBoundingClientRect();
      ["fontFamily", "fontWeight", "fontSize", "lineHeight", "letterSpacing", "textWrap", "color"].forEach(function (p) {
        nameEl.style[p] = cs[p];
      });
      nameEl.style.left = r.left + "px";
      nameEl.style.top = r.top + "px";
      nameEl.style.width = r.width + "px";

      var chars = [];
      h1.textContent.trim().split("").forEach(function (ch) {
        var s = document.createElement("span");
        s.className = "dc-intro-ch";
        s.textContent = ch;
        nameEl.appendChild(s);
        chars.push(s);
      });
      var caret = document.createElement("span");
      caret.className = "dc-intro-caret";

      // Start centred and larger, then shrink into place. The title is a full-width
      // block, so centre on the glyphs themselves rather than its box.
      var range = document.createRange();
      range.selectNodeContents(h1);
      var t = range.getBoundingClientRect();
      if (!t.width) t = r;
      var vw = window.innerWidth, vh = window.innerHeight;
      var scale = Math.max(1, Math.min(1.35, (vw * 0.9) / t.width));
      var dx = vw / 2 - (t.left + t.width / 2);
      var dy = vh / 2 - (t.top + t.height / 2);
      nameEl.style.transformOrigin = (t.left - r.left + t.width / 2) + "px " + (t.top - r.top + t.height / 2) + "px";
      var from = "translate(" + dx + "px," + dy + "px) scale(" + scale + ")";
      nameEl.style.transform = from;

      var step = TYPE_MS / chars.length;
      chars.forEach(function (s, i) {
        setTimeout(function () {
          s.style.opacity = "1";
          s.after(caret);
        }, i * step);
      });

      return sleep(TYPE_MS + HOLD_MS).then(function () {
        caret.remove();
        root.classList.remove("dc-intro");   // page shows underneath the fading backdrop
        var ease = "cubic-bezier(0.65, 0, 0.35, 1)";
        bg.animate([{ opacity: 1 }, { opacity: 0 }], { duration: MOVE_MS, easing: ease, fill: "forwards" });
        var move = nameEl.animate([{ transform: from }, { transform: "none" }], { duration: MOVE_MS, easing: ease, fill: "forwards" });
        return move.finished;
      }).then(function () {
        clearTimeout(safety);
        finish();
      });
    }).catch(finish);
  }

  if (document.body) run();
  else document.addEventListener("DOMContentLoaded", run);
})();
