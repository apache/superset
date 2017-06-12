(function() {
  const req = new XMLHttpRequest();
  req.open('get', '/static/assets/dist/manifest.json', false);
  req.onreadystatechange = function () {
    if (req.readyState != 4 || req.status != 200) return;
    window.manifestJSON = JSON.parse(req.responseText);
  };
  req.send();
})();
