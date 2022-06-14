var _paq = (window._paq = window._paq || []);
/* tracker methods like "setCustomDimension" should be called before "trackPageView" */
/* We explicitly disable cookie tracking to avoid privacy issues */
_paq.push(['disableCookies']);
_paq.push(['trackPageView']);
_paq.push(['enableLinkTracking']);
(function () {
  var u = 'https://analytics.apache.org/';
  _paq.push(['setTrackerUrl', u + 'matomo.php']);
  _paq.push(['setSiteId', '22']);
  var d = document,
    g = d.createElement('script'),
    s = d.getElementsByTagName('script')[0];
  g.async = true;
  g.src = u + 'matomo.js';
  s.parentNode.insertBefore(g, s);
})();
