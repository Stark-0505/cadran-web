// Premier affichage instantané : on réapplique le fond et la mise en page
// mémorisés dans localStorage avant que les modules ne se chargent, pour
// éviter un flash à chaque nouvel onglet.
(function () {
  try {
    var boot = JSON.parse(localStorage.getItem('cadran.boot') || 'null');
    if (!boot) return;
    var root = document.documentElement;
    var k;
    if (boot.attrs) for (k in boot.attrs) root.setAttribute(k, boot.attrs[k]);
    if (boot.vars) for (k in boot.vars) root.style.setProperty(k, boot.vars[k]);
    // Fond avec une variante sombre : celle du thème actuel du système, si elle a déjà été affichée.
    var v = boot;
    if (boot.split && boot.byScheme) {
      var scheme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      if (boot.byScheme[scheme]) {
        v = boot.byScheme[scheme];
        root.setAttribute('data-ink', v.ink);
      }
    }
    var wp = document.getElementById('wallpaper');
    if (wp && v.bg) {
      // The saved image background is a tiny preview (LQIP). Do not show it as the final
      // wallpaper. The app module will load and apply the full-resolution image.
      // If the module fails, keep the sharp CSS fallback instead of a blurred full-screen page.
      if (!/url\([\"']?data:image\//i.test(v.bg)) wp.style.background = v.bg;
    }
    var dim = document.getElementById('dim');
    if (dim && typeof v.dim === 'number') dim.style.opacity = String(v.dim);
  } catch (e) {
    /* cache illisible : le rendu normal prendra le relais */
  }
})();
