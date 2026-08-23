/* ==========================================================================
   FAITHFUL CARD — open/close wiring for the coordinate composition.
   Physics contract unchanged from the reused interaction layer (ledger
   #168): the MAIN ITEM is steel and only ever MOVES; the SUBITEMs are
   glass and only ever LIGHT UP. Toggling one block does not affect the
   others (independent state per block, matching the harness precedent).
   ========================================================================== */
(function () {
  'use strict';

  function toggleBlock(block) {
    var main = block.querySelector('.fc-main');
    var isCollapsed = block.classList.contains('is-collapsed');
    clearTimeout(block._fcTimer);
    if (isCollapsed) {
      // EXPAND: reveal (display:block) first, then animate in
      block.classList.remove('is-anim-collapse', 'is-collapsed');
      main.setAttribute('aria-expanded', 'true');
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          block.classList.add('is-anim-expand');
        });
      });
      block._fcTimer = setTimeout(function () {
        block.classList.remove('is-anim-expand');
      }, 900);
    } else {
      // COLLAPSE: animate out first, then set display:none
      block.classList.remove('is-anim-expand');
      block.classList.add('is-anim-collapse');
      main.setAttribute('aria-expanded', 'false');
      block._fcTimer = setTimeout(function () {
        block.classList.remove('is-anim-collapse');
        block.classList.add('is-collapsed');
      }, 900);
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('.fc-block').forEach(function (block) {
      var main = block.querySelector('.fc-main');
      main.addEventListener('click', function () { toggleBlock(block); });
      main.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleBlock(block); }
      });
    });
    window.__fcToggle = function (i) {
      var block = document.querySelectorAll('.fc-block')[i];
      toggleBlock(block);
    };
    window.__fcReady = true;
  });
})();
