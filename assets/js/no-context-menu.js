/* No right-click menu on the site's public pages.
   This is cosmetic, not security: View Source and DevTools still work,
   and nothing secret is on the page anyway. Text fields keep their menu so
   paste / spellcheck still work. Games that use right-click (aim) are
   unaffected: this only stops the menu, the mouse button still fires. */
(function () {
  document.addEventListener('contextmenu', function (e) {
    var t = e.target;
    if (t && t.closest && t.closest('input, textarea, [contenteditable=""], [contenteditable="true"]')) return;
    e.preventDefault();
  });
})();
