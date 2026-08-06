// textbg.js — fills the page background with the brand name repeated as a
// grid of large characters. Rows scroll horizontally in alternating
// directions forever; characters near the cursor rotate to point toward it.
(function () {
  var WORD = 'MEMPHY ';
  var host = document.getElementById('textbg');
  if (!host) return;

  var chars = []; // {el, x, y} cached on layout

  function build() {
    host.innerHTML = '';
    chars = [];
    var probe = document.createElement('div');
    probe.className = 'tbg-row';
    probe.style.visibility = 'hidden';
    probe.textContent = WORD;
    host.appendChild(probe);
    var rowH = probe.getBoundingClientRect().height || 96;
    var wordW = probe.getBoundingClientRect().width || 400;
    host.removeChild(probe);

    var rows = Math.ceil(innerHeight / rowH) + 1;
    var reps = Math.ceil(innerWidth / wordW) * 2 + 2; // x2: animation loops at -50%

    for (var r = 0; r < rows; r++) {
      var row = document.createElement('div');
      row.className = 'tbg-row' + (r % 2 ? ' rev' : '');
      row.style.animationDuration = (34 + (r % 5) * 9) + 's';
      var text = '';
      for (var i = 0; i < reps; i++) text += WORD;
      for (var c = 0; c < text.length; c++) {
        var s = document.createElement('span');
        s.textContent = text[c] === ' ' ? ' ' : text[c];
        row.appendChild(s);
      }
      host.appendChild(row);
    }
  }

  var RADIUS = 260;
  function onMove(e) {
    var els = host.querySelectorAll('span');
    // cheap pass: only test elements whose row is near the cursor vertically
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      var rect = el.getBoundingClientRect();
      var cx = rect.left + rect.width / 2;
      var cy = rect.top + rect.height / 2;
      var dx = e.clientX - cx, dy = e.clientY - cy;
      if (Math.abs(dx) > RADIUS || Math.abs(dy) > RADIUS) {
        if (el.style.transform) el.style.transform = '';
        continue;
      }
      var d = Math.hypot(dx, dy);
      if (d < RADIUS) {
        el.style.transform = 'rotate(' + Math.atan2(dy, dx) + 'rad)';
      } else if (el.style.transform) {
        el.style.transform = '';
      }
    }
  }

  var moveScheduled = false;
  addEventListener('mousemove', function (e) {
    if (moveScheduled) return;
    moveScheduled = true;
    requestAnimationFrame(function () {
      onMove(e);
      moveScheduled = false;
    });
  }, { passive: true });

  var rz;
  addEventListener('resize', function () {
    clearTimeout(rz);
    rz = setTimeout(build, 200);
  });

  build();
})();
