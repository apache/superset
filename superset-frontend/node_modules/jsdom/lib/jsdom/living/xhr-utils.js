"use strict";

const request = require("request");
const EventEmitter = require("events").EventEmitter;
const fs = require("fs");
const URL = require("whatwg-url").URL;

const utils = require("../utils");
const xhrSymbols = require("./xmlhttprequest-symbols");

function wrapCookieJarForRequest(cookieJar) {
  const jarWrapper = request.jar();
  jarWrapper._jar = cookieJar;
  return jarWrapper;
}

function getRequestHeader(requestHeaders, header) {
  const lcHeader = header.toLowerCase();
  const keys = Object.keys(requestHeaders);
  let n = keys.length;
  while (n--) {
    const key = keys[n];
    if (key.toLowerCase() === lcHeader) {
      return requestHeaders[key];
    }
  }
  return null;
}

function updateRequestHeader(requestHeaders, header, newValue) {
  const lcHeader = header.toLowerCase();
  const keys = Object.keys(requestHeaders);
  let n = keys.length;
  while (n--) {
    const key = keys[n];
    if (key.toLowerCase() === lcHeader) {
      requestHeaders[key] = newValue;
    }
  }
}

const simpleMethods = new Set(["GET", "HEAD", "POST"]);
const simpleHeaders = new Set(["accept", "accept-language", "content-language", "content-type"]);

exports.getRequestHeader = getRequestHeader;
exports.updateRequestHeader = updateRequestHeader;
exports.simpleHeaders = simpleHeaders;

// return a "request" client object or an event emitter matching the same behaviour for unsupported protocols
// the callback should be called with a "request" response object or an event emitter matching the same behaviour too
exports.createClient = function createClient(xhr) {
  const flag = xhr[xhrSymbols.flag];
  const properties = xhr[xhrSymbols.properties];
  const urlObj = new URL(flag.uri);
  const uri = urlObj.href;
  const ucMethod = flag.method.toUpperCase();

  const requestManager = flag.requestManager;

  if (urlObj.protocol === "file:") {
    const response = new EventEmitter();
    response.statusCode = 200;
    response.rawHeaders = [];
    response.headers = {};
    response.request = { uri: urlObj };
    const filePath = urlObj.pathname
      .replace(/^file:\/\//, "")
      .replace(/^\/([a-z]):\//i, "$1:/")
      .replace(/%20/g, " ");

    const client = new EventEmitter();

    const readableStream = fs.createReadStream(filePath, { encoding: null });

    readableStream.on("data", chunk => {
      response.emit("data", chunk);
      client.emit("data", chunk);
    });

    readableStream.on("end", () => {
      response.emit("end");
      client.emit("end");
    });

    readableStream.on("error", err => {
      response.emit("error", err);
      client.emit("error", err);
    });

    client.abort = function () {
      readableStream.destroy();
      client.emit("abort");
    };

    if (requestManager) {
      const req = {
        abort() {
          properties.abortError = true;
          xhr.abort();
        }
      };
      requestManager.add(req);
      const rmReq = requestManager.remove.bind(requestManager, req);
      client.on("abort", rmReq);
      client.on("error", rmReq);
      client.on("end", rmReq);
    }

    process.nextTick(() => client.emit("response", response));

    return client;
  }

  if (urlObj.protocol === "data:") {
    const response = new EventEmitter();

    response.request = { uri: urlObj };

    const client = new EventEmitter();

    let buffer;
    if (ucMethod === "GET") {
      try {
        const dataUrlContent = utils.parseDataUrl(uri);
        buffer = dataUrlContent.buffer;
        response.statusCode = 200;
        response.rawHeaders = dataUrlContent.type ? ["Content-Type", dataUrlContent.type] : [];
        response.headers = dataUrlContent.type ? { "content-type": dataUrlContent.type } : {};
      } catch (err) {
        process.nextTick(() => client.emit("error", err));
        return client;
      }
    } else {
      buffer = new Buffer("");
      response.statusCode = 0;
      response.rawHeaders = {};
      response.headers = {};
    }

    client.abort = () => {
      // do nothing
    };

    process.nextTick(() => {
      client.emit("response", response);
      process.nextTick(() => {
        response.emit("data", buffer);
        client.emit("data", buffer);
        response.emit("end");
        client.emit("end");
      });
    });

    return client;
  }

  const requestHeaders = {};

  for (const header in flag.requestHeaders) {
    requestHeaders[header] = flag.requestHeaders[header];
  }

  if (getRequestHeader(flag.requestHeaders, "referer") === null) {
    requestHeaders.Referer = flag.referrer;
  }
  if (getRequestHeader(flag.requestHeaders, "user-agent") === null) {
    requestHeaders["User-Agent"] = flag.userAgent;
  }
  if (getRequestHeader(flag.requestHeaders, "accept-language") === null) {
    requestHeaders["Accept-Language"] = "en";
  }
  if (getRequestHeader(flag.requestHeaders, "accept") === null) {
    requestHeaders.Accept = "*/*";
  }

  const crossOrigin = flag.origin !== urlObj.origin;
  if (crossOrigin) {
    requestHeaders.Origin = flag.origin;
  }

  const options = {
    uri,
    method: flag.method,
    headers: requestHeaders,
    gzip: true,
    maxRedirects: 21,
    followAllRedirects: true,
    encoding: null,
    pool: flag.pool,
    agentOptions: flag.agentOptions,
    strictSSL: flag.strictSSL
  };
  if (flag.auth) {
    options.auth = {
      user: flag.auth.user || "",
      pass: flag.auth.pass || "",
      sendImmediately: false
    };
  }
  if (flag.cookieJar && (!crossOrigin || flag.withCredentials)) {
    options.jar = wrapCookieJarForRequest(flag.cookieJar);
  }

  if (flag.proxy) {
    options.proxy = flag.proxy;
  }

  const body = flag.body;
  const hasBody = body !== undefined &&
    body !== null &&
    body !== "" &&
    !(ucMethod === "HEAD" || ucMethod === "GET");

  if (hasBody && !flag.formData) {
    options.body = body;
  }

  if (hasBody && getRequestHeader(flag.requestHeaders, "content-type") === null) {
    requestHeaders["Content-Type"] = "text/plain;charset=UTF-8";
  }

  function doRequest() {
    try {
      const client = request(options);

      if (hasBody && flag.formData) {
        const form = client.form();
        for (const entry of body) {
          form.append(entry.name, entry.value, entry.options);
        }
      }

      return client;
    } catch (e) {
      const client = new EventEmitter();
      process.nextTick(() => client.emit("error", e));
      return client;
    }
  }

  let client;

  const nonSimpleHeaders = Object.keys(flag.requestHeaders)
    .filter(header => !simpleHeaders.has(header.toLowerCase()));

  if (crossOrigin && (!simpleMethods.has(ucMethod) || nonSimpleHeaders.length > 0)) {
    client = new EventEmitter();

    const preflightRequestHeaders = [];
    for (const header in requestHeaders) {
      preflightRequestHeaders[header] = requestHeaders[header];
    }

    preflightRequestHeaders["Access-Control-Request-Method"] = flag.method;
    if (nonSimpleHeaders.length > 0) {
      preflightRequestHeaders["Access-Control-Request-Headers"] = nonSimpleHeaders.join(", ");
    }

    flag.preflight = true;

    const preflightOptions = {
      uri,
      method: "OPTIONS",
      headers: preflightRequestHeaders,
      followRedirect: false,
      encoding: null,
      pool: flag.pool,
      agentOptions: flag.agentOptions,
      strictSSL: flag.strictSSL
    };

    if (flag.proxy) {
      preflightOptions.proxy = flag.proxy;
    }

    const preflightClient = request(preflightOptions);

    preflightClient.on("response", resp => {
      if (resp.statusCode >= 200 && resp.statusCode <= 299) {
        const realClient = doRequest();
        realClient.on("response", res => client.emit("response", res));
        realClient.on("data", chunk => client.emit("data", chunk));
        realClient.on("end", () => client.emit("end"));
        realClient.on("abort", () => client.emit("abort"));
        realClient.on("request", req => {
          client.headers = realClient.headers;
          client.emit("request", req);
        });
        realClient.on("redirect", () => {
          client.response = realClient.response;
          client.emit("redirect");
        });
        realClient.on("error", err => client.emit("error", err));
        client.abort = () => {
          realClient.abort();
        };
      } else {
        client.emit("error", new Error("Response for preflight has invalid HTTP status code " + resp.statusCode));
      }
    });

    preflightClient.on("error", err => client.emit("error", err));

    client.abort = () => {
      preflightClient.abort();
    };
  } else {
    client = doRequest();
  }

  if (requestManager) {
    const req = {
      abort() {
        properties.abortError = true;
        xhr.abort();
      }
    };
    requestManager.add(req);
    const rmReq = requestManager.remove.bind(requestManager, req);
    client.on("abort", rmReq);
    client.on("error", rmReq);
    client.on("end", rmReq);
  }

  return client;
};

