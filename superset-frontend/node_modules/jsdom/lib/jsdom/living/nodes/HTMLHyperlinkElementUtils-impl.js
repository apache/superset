"use strict";
const whatwgURL = require("whatwg-url");
const parseURLToResultingURLRecord = require("../helpers/document-base-url").parseURLToResultingURLRecord;

exports.implementation = class HTMLHyperlinkElementUtilsImpl {
  _htmlHyperlinkElementUtilsSetup() {
    this.url = null;
  }

  toString() {
    return this.href;
  }

  get href() {
    setTheURL(this);
    const url = this.url;

    if (url === null) {
      const href = this.getAttribute("href");
      return href === null ? "" : href;
    }

    return whatwgURL.serializeURL(url);
  }

  set href(v) {
    this.setAttribute("href", v);
  }

  get origin() {
    setTheURL(this);

    if (this.url === null) {
      return "";
    }

    return whatwgURL.serializeURLToUnicodeOrigin(this.url);
  }

  get protocol() {
    setTheURL(this);

    if (this.url === null) {
      return ":";
    }

    return this.url.scheme + ":";
  }

  set protocol(v) {
    if (this.url === null) {
      return;
    }

    whatwgURL.basicURLParse(v + ":", { url: this.url, stateOverride: "scheme start" });
    updateHref(this);
  }

  get username() {
    setTheURL(this);

    if (this.url === null) {
      return "";
    }

    return this.url.username;
  }

  set username(v) {
    const url = this.url;

    if (url === null || url.host === null || url.cannotBeABaseURL) {
      return;
    }

    whatwgURL.setTheUsername(url, v);
    updateHref(this);
  }

  get password() {
    setTheURL(this);
    const url = this.url;

    if (url === null || url.password === null) {
      return "";
    }

    return url.password;
  }

  set password(v) {
    const url = this.url;

    if (url === null || url.host === null || url.cannotBeABaseURL) {
      return;
    }

    whatwgURL.setThePassword(url, v);
    updateHref(this);
  }

  get host() {
    setTheURL(this);
    const url = this.url;

    if (url === null || url.host === null) {
      return "";
    }

    if (url.port === null) {
      return whatwgURL.serializeHost(url.host);
    }

    return whatwgURL.serializeHost(url.host) + ":" + whatwgURL.serializeInteger(url.port);
  }

  set host(v) {
    setTheURL(this);
    const url = this.url;

    if (url === null || url.cannotBeABaseURL) {
      return;
    }

    whatwgURL.basicURLParse(v, { url, stateOverride: "host" });
    updateHref(this);
  }

  get hostname() {
    setTheURL(this);
    const url = this.url;

    if (url === null || url.host === null) {
      return "";
    }

    return whatwgURL.serializeHost(url.host);
  }

  set hostname(v) {
    setTheURL(this);
    const url = this.url;

    if (url === null || url.cannotBeABaseURL) {
      return;
    }

    whatwgURL.basicURLParse(v, { url, stateOverride: "hostname" });
    updateHref(this);
  }

  get port() {
    setTheURL(this);
    const url = this.url;

    if (url === null || url.port === null) {
      return "";
    }

    return whatwgURL.serializeInteger(url.port);
  }

  set port(v) {
    setTheURL(this);
    const url = this.url;

    if (url === null || url.host === null || url.cannotBeABaseURL || url.scheme === "file") {
      return;
    }

    whatwgURL.basicURLParse(v, { url, stateOverride: "port" });
    updateHref(this);
  }

  get pathname() {
    setTheURL(this);
    const url = this.url;

    if (url === null) {
      return "";
    }

    if (url.cannotBeABaseURL) {
      return url.path[0];
    }

    return "/" + url.path.join("/");
  }

  set pathname(v) {
    setTheURL(this);
    const url = this.url;

    if (url === null || url.cannotBeABaseURL) {
      return;
    }

    url.path = [];
    whatwgURL.basicURLParse(v, { url, stateOverride: "path start" });
  }

  get search() {
    setTheURL(this);
    const url = this.url;

    if (url === null || url.query === null || url.query === "") {
      return "";
    }

    return "?" + url.query;
  }

  set search(v) {
    setTheURL(this);
    const url = this.url;

    if (url === null) {
      return;
    }

    if (v === "") {
      url.query = null;
    } else {
      const input = v[0] === "?" ? v.substring(1) : v;
      url.query = "";
      whatwgURL.basicURLParse(input, { url, stateOverride: "query" });
    }
    updateHref(this);
  }

  get hash() {
    setTheURL(this);
    const url = this.url;

    if (url === null || url.fragment === null || url.fragment === "") {
      return "";
    }

    return "#" + url.fragment;
  }

  set hash(v) {
    setTheURL(this);
    const url = this.url;

    if (url === null || url.scheme === "javascript") {
      return;
    }

    if (v === "") {
      url.fragment = null;
    } else {
      const input = v[0] === "#" ? v.substring(1) : v;
      url.fragment = "";
      whatwgURL.basicURLParse(input, { url, stateOverride: "fragment" });
    }
    updateHref(this);
  }
};

function setTheURL(hheu) {
  const href = hheu.getAttribute("href");
  if (href === null) {
    hheu.url = null;
    return;
  }

  const parsed = parseURLToResultingURLRecord(href, hheu._ownerDocument);

  hheu.url = parsed === "failure" ? null : parsed;
}

function updateHref(hheu) {
  hheu.setAttribute("href", whatwgURL.serializeURL(hheu.url));
}
