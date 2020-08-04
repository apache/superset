"use strict";

// https://html.spec.whatwg.org/multipage/webappapis.html#event-handlers-on-elements,-document-objects,-and-window-objects

module.exports = new Set(["onblur", "onerror", "onfocus", "onload", "onresize", "onscroll", "onafterprint",
  "onbeforeprint", "onbeforeunload", "onhashchange", "onlanguagechange", "onmessage", "onoffline", "ononline",
  "onpagehide", "onpageshow", "onpopstate", "onstorage", "onunload"]);

// level2/html sets up setters/getters on HTMLBodyElement that proxy to the window (setting data properties there)
// level1/core sets up so that modifying the appropriate attributes on body elements will forward to setting on
// the window, with the appropriate `this`.
