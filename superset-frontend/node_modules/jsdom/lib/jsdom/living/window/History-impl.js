"use strict";
const DOMException = require("../../web-idl/DOMException.js");
const documentBaseURLSerialized = require("../helpers/document-base-url.js").documentBaseURLSerialized;
const parseURLToResultingURLRecord = require("../helpers/document-base-url.js").parseURLToResultingURLRecord;
const traverseHistory = require("./navigation.js").traverseHistory;

exports.implementation = class HistoryImpl {
  constructor(args, privateData) {
    this._window = privateData.window;
    this._document = privateData.document;
    this._actAsIfLocationReloadCalled = privateData.actAsIfLocationReloadCalled;
    this._state = null;
    this._latestEntry = null;

    this._historyTraversalQueue = new Set();
  }

  _guardAgainstInactiveDocuments() {
    if (!this._window) {
      throw new DOMException(DOMException.SECURITY_ERR,
        "History object is associated with a document that is not fully active.");
    }
  }

  get length() {
    this._guardAgainstInactiveDocuments();

    return this._window._sessionHistory.length;
  }

  get state() {
    this._guardAgainstInactiveDocuments();

    return this._state;
  }

  go(delta) {
    this._guardAgainstInactiveDocuments();

    if (delta === 0) {
      this._actAsIfLocationReloadCalled();
    } else {
      this._queueHistoryTraversalTask(() => {
        const newIndex = this._window._currentSessionHistoryEntryIndex + delta;
        if (newIndex < 0 || newIndex >= this._window._sessionHistory.length) {
          return;
        }

        const specifiedEntry = this._window._sessionHistory[newIndex];

        // Not implemented: unload a document guard

        // Not clear that this should be queued. html/browsers/history/the-history-interface/004.html can be fixed
        // by removing the queue, but doing so breaks some tests in history.js that also pass in browsers.
        this._queueHistoryTraversalTask(() => traverseHistory(this._window, specifiedEntry));
      });
    }
  }

  back() {
    this.go(-1);
  }

  forward() {
    this.go(+1);
  }

  pushState(data, title, url) {
    this._sharedPushAndReplaceState(data, title, url, "pushState");
  }
  replaceState(data, title, url) {
    this._sharedPushAndReplaceState(data, title, url, "replaceState");
  }

  _sharedPushAndReplaceState(data, title, url, methodName) {
    this._guardAgainstInactiveDocuments();

    // TODO structured clone data

    let newURL;
    if (url !== null) {
      // Not implemented: use of entry settings object's API base URL. Instead we just use the document base URL. The
      // difference matters in the case of cross-frame calls.
      newURL = parseURLToResultingURLRecord(url, this._document);

      if (newURL === "failure") {
        throw new DOMException(DOMException.SECURITY_ERR, `Could not parse url argument "${url}" to ${methodName} ` +
          `against base URL "${documentBaseURLSerialized(this._document)}".`);
      }

      if (newURL.scheme !== this._document._URL.scheme ||
          newURL.username !== this._document._URL.username ||
          newURL.password !== this._document._URL.password ||
          newURL.host !== this._document._URL.host ||
          newURL.port !== this._document._URL.port ||
          newURL.cannotBeABaseURL !== this._document._URL.cannotBeABaseURL) {
        throw new DOMException(DOMException.SECURITY_ERR, `${methodName} cannot update history to a URL which ` +
          `differs in components other than in path, query, or fragment.`);
      }

      // Not implemented: origin check (seems to only apply to documents with weird origins, e.g. sandboxed ones)
    } else {
      newURL = this._window._sessionHistory[this._window._currentSessionHistoryEntryIndex].url;
    }

    if (methodName === "pushState") {
      this._window._sessionHistory.splice(this._window._currentSessionHistoryEntryIndex + 1, Infinity);

      this._clearHistoryTraversalTasks();

      this._window._sessionHistory.push({
        document: this._document,
        stateObject: data,
        title,
        url: newURL
      });
      this._window._currentSessionHistoryEntryIndex = this._window._sessionHistory.length - 1;
    } else {
      const currentEntry = this._window._sessionHistory[this._window._currentSessionHistoryEntryIndex];
      currentEntry.stateObject = data;
      currentEntry.title = title;
      currentEntry.url = newURL;
    }

    this._document._URL = newURL;
    this._state = data; // TODO clone again!! O_o
    this._latestEntry = this._window._sessionHistory[this._window._currentSessionHistoryEntryIndex];
  }

  _queueHistoryTraversalTask(fn) {
    const timeoutId = this._window.setTimeout(() => {
      this._historyTraversalQueue.delete(timeoutId);
      fn();
    }, 0);

    this._historyTraversalQueue.add(timeoutId);
  }

  _clearHistoryTraversalTasks() {
    for (const timeoutId of this._historyTraversalQueue) {
      this._window.clearTimeout(timeoutId);
    }
    this._historyTraversalQueue.clear();
  }
};
