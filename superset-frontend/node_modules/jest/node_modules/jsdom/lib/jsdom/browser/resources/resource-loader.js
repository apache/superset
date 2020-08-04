"use strict";
const fs = require("fs");
const { parseURL } = require("whatwg-url");
const dataURLFromRecord = require("data-urls").fromURLRecord;
const request = require("request-promise-native");
const wrapCookieJarForRequest = require("../../living/helpers/wrap-cookie-jar-for-request");
const packageVersion = require("../../../../package.json").version;
const IS_BROWSER = Object.prototype.toString.call(process) !== "[object process]";

module.exports = class ResourceLoader {
  constructor({
    strictSSL = true,
    proxy = undefined,
    userAgent = `Mozilla/5.0 (${process.platform || "unknown OS"}) AppleWebKit/537.36 ` +
                `(KHTML, like Gecko) jsdom/${packageVersion}`
  } = {}) {
    this._strictSSL = strictSSL;
    this._proxy = proxy;
    this._userAgent = userAgent;
  }

  _readFile(filePath) {
    let readableStream;
    let abort; // Native Promises doesn't have an "abort" method.

    /*
     * Creating a promise for two reason:
     *   1. fetch always return a promise.
     *   2. We need to add an abort handler.
    */
    const promise = new Promise((resolve, reject) => {
      readableStream = fs.createReadStream(filePath);
      let data = Buffer.alloc(0);

      abort = reject;

      readableStream.on("error", reject);

      readableStream.on("data", chunk => {
        data = Buffer.concat([data, chunk]);
      });

      readableStream.on("end", () => {
        resolve(data);
      });
    });

    promise.abort = () => {
      readableStream.destroy();
      const error = new Error("request canceled by user");
      error.isAbortError = true;
      abort(error);
    };

    return promise;
  }

  _getRequestOptions({ cookieJar, referrer, accept = "*/*" }) {
    const requestOptions = {
      encoding: null,
      gzip: true,
      jar: wrapCookieJarForRequest(cookieJar),
      strictSSL: this._strictSSL,
      proxy: this._proxy,
      forever: true,
      headers: {
        "User-Agent": this._userAgent,
        "Accept-Language": "en",
        Accept: accept
      }
    };

    if (referrer && !IS_BROWSER) {
      requestOptions.headers.referer = referrer;
    }

    return requestOptions;
  }

  fetch(urlString, options = {}) {
    const url = parseURL(urlString);

    if (!url) {
      return Promise.reject(new Error(`Tried to fetch invalid URL ${urlString}`));
    }

    switch (url.scheme) {
      case "data": {
        return Promise.resolve(dataURLFromRecord(url).body);
      }

      case "http":
      case "https": {
        const requestOptions = this._getRequestOptions(options);
        return request(urlString, requestOptions);
      }

      case "file": {
        // TODO: Improve the URL => file algorithm. See https://github.com/jsdom/jsdom/pull/2279#discussion_r199977987
        const filePath = urlString
          .replace(/^file:\/\//, "")
          .replace(/^\/([a-z]):\//i, "$1:/")
          .replace(/%20/g, " ");

        return this._readFile(filePath);
      }

      default: {
        return Promise.reject(new Error(`Tried to fetch URL ${urlString} with invalid scheme ${url.scheme}`));
      }
    }
  }
};
