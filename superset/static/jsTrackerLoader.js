const setupBwtag = function (parsedData) {
  window.bwDataLayer = window.bwDataLayer || [];
  window.bwtag = function () {
    return bwDataLayer.push(arguments);
  };

  window.bwtag("set", "appVersion", null);
  window.bwtag("set", "appId", parsedData.appId);
  window.bwtag("set", "publicKey", parsedData.publicKey);

  window.bwtag("identify", parsedData.user.email, {
    email: parsedData.user.email,
    full_name: parsedData.user.firstName + " " + parsedData.user.lastName,
  });
  window.bwtag("pv");
};

const docReady = function (fn) {
  if (
    document.readyState === "complete" ||
    document.readyState === "interactive"
  ) {
    setTimeout(fn, 1);
  } else {
    document.addEventListener("DOMContentLoaded", fn);
  }
};

const script_bw = document.createElement("script");
script_bw.src = "https://cdn.brightwrite.com/dist/bw-analytics-3.latest.min.js";
script_bw.async = true;
script_bw.onload = function () {};

docReady(function () {
  const data = document.getElementById("app").getAttribute("data-bootstrap");
  const parsedData = JSON.parse(data);
  setupBwtag(parsedData);
});

document.body.append(script_bw);
