"use strict";
const whatwgURL = require("whatwg-url");
const arrayEqual = require("array-equal");
const notImplemented = require("../../browser/not-implemented.js");
const HashChangeEvent = require("../generated/HashChangeEvent.js");
const PopStateEvent = require("../generated/PopStateEvent.js");
const idlUtils = require("../generated/utils");

exports.traverseHistory = (window, specifiedEntry, flags) => {
  // Not spec compliant, just minimal. Lots of missing steps.

  if (flags === undefined) {
    flags = {};
  }
  const nonBlockingEvents = Boolean(flags.nonBlockingEvents);

  const document = idlUtils.implForWrapper(window._document);

  const currentEntry = window._sessionHistory[window._currentSessionHistoryEntryIndex];

  if (currentEntry.title === undefined) {
    currentEntry.title = document.title;
  }

  document._URL = specifiedEntry.url;

  let hashChanged = false;
  let oldURL;
  let newURL;
  if (specifiedEntry.url.fragment !== currentEntry.url.fragment) {
    hashChanged = true;
    oldURL = currentEntry.url;
    newURL = specifiedEntry.url;
  }

  const state = specifiedEntry.stateObject; // TODO structured clone
  document._history._state = state;

  const stateChanged = specifiedEntry.document._history._latestEntry !== specifiedEntry;
  specifiedEntry.document._history._latestEntry = specifiedEntry;

  if (nonBlockingEvents) {
    window.setTimeout(fireEvents, 0);
  } else {
    fireEvents();
  }

  function fireEvents() {
    if (stateChanged) {
      window.dispatchEvent(PopStateEvent.create(["popstate", {
        bubbles: true,
        cancelable: false,
        state
      }]));
    }

    if (hashChanged) {
      window.dispatchEvent(HashChangeEvent.create(["hashchange", {
        bubbles: true,
        cancelable: false,
        oldURL: whatwgURL.serializeURL(oldURL),
        newURL: whatwgURL.serializeURL(newURL)
      }]));
    }
  }

  window._currentSessionHistoryEntryIndex = window._sessionHistory.indexOf(specifiedEntry);
};

exports.navigate = (window, newURL) => {
  // This is NOT a spec-compliant implementation of navigation in any way. It implements a few selective steps that
  // are nice for jsdom users, regarding hash changes. We could maybe implement javascript: URLs in the future, but
  // the rest is too hard.

  const document = idlUtils.implForWrapper(window._document);

  const currentURL = document._URL;

  if (newURL.scheme !== currentURL.scheme ||
      newURL.username !== currentURL.username ||
      newURL.password !== currentURL.password ||
      newURL.host !== currentURL.host ||
      newURL.port !== currentURL.port ||
      !arrayEqual(newURL.path, currentURL.path) ||
      newURL.query !== currentURL.query ||
      // Omitted per spec: url.fragment !== this._url.fragment ||
      newURL.cannotBeABaseURL !== currentURL.cannotBeABaseURL) {
    notImplemented("navigation (except hash changes)", window);
    return;
  }

  if (newURL.fragment !== currentURL.fragment) {
    // https://html.spec.whatwg.org/#scroll-to-fragid

    window._sessionHistory.splice(window._currentSessionHistoryEntryIndex + 1, Infinity);

    document._history._clearHistoryTraversalTasks();

    const newEntry = { document, url: newURL };
    window._sessionHistory.push(newEntry);
    exports.traverseHistory(window, newEntry, { nonBlockingEvents: true });
  }
};
