"use strict";
/* eslint-disable no-process-exit */

const util = require("util");

const jsdom = require("../../jsdom");
const xhrSymbols = require("./xmlhttprequest-symbols");
const tough = require("tough-cookie");

const doc = jsdom.jsdom();
const xhr = new doc.defaultView.XMLHttpRequest();

const chunks = [];

process.stdin.on("data", chunk => {
  chunks.push(chunk);
});

process.stdin.on("end", () => {
  const buffer = Buffer.concat(chunks);
  const flag = JSON.parse(buffer.toString(), (k, v) => {
    if (v && v.type === "Buffer" && v.data) {
      return new Buffer(v.data);
    }
    if (k === "cookieJar" && v) {
      return tough.CookieJar.fromJSON(v);
    }
    return v;
  });
  flag.synchronous = false;
  xhr[xhrSymbols.flag] = flag;
  const properties = xhr[xhrSymbols.properties];
  properties.readyState = doc.defaultView.XMLHttpRequest.OPENED;
  try {
    xhr.addEventListener("loadend", () => {
      if (properties.error) {
        properties.error = properties.error.stack || util.inspect(properties.error);
      }
      process.stdout.write(JSON.stringify({ properties }), () => {
        process.exit(0);
      });
    }, false);
    xhr.send(flag.body);
  } catch (error) {
    properties.error += error.stack || util.inspect(error);
    process.stdout.write(JSON.stringify({ properties }), () => {
      process.exit(0);
    });
  }
});
