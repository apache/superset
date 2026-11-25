/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

// Two origins, because that is what the SDK actually deals with: the host app
// on one, the Superset instance on the other. No dependencies.

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const sdkRoot = join(here, "..");

export const HOST_PORT = Number(process.env.RIG_HOST_PORT || 8100);
export const SUPERSET_PORT = Number(process.env.RIG_SUPERSET_PORT || 8200);

const hostOrigin = `http://localhost:${HOST_PORT}`;
const supersetOrigin = `http://localhost:${SUPERSET_PORT}`;

/** Every guest token this rig has minted, so a test can count them. */
const minted = [];

function base64url(value) {
  return Buffer.from(value).toString("base64url");
}

/** A JWT the SDK can actually decode, since it reads `exp` off the token. */
function mintGuestToken(ttlSeconds) {
  const claims = {
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
    user: { username: "rig" },
    resources: [{ type: "dashboard", id: "rig-dashboard" }],
    serial: minted.length + 1,
  };
  const token = `${base64url('{"alg":"HS256","typ":"JWT"}')}.${base64url(
    JSON.stringify(claims),
  )}.rig-signature`;
  minted.push({ at: Date.now(), ttlSeconds, serial: claims.serial });
  return token;
}

function send(res, status, body, type = "text/html; charset=utf-8") {
  res.writeHead(status, {
    "content-type": type,
    "cache-control": "no-store",
    // The host page needs to call the token endpoint from its own origin only,
    // but the Superset origin loads nothing from here, so this stays simple.
    "access-control-allow-origin": "*",
  });
  res.end(body);
}

async function sendFile(res, path, type) {
  try {
    send(res, 200, await readFile(path), type);
  } catch (err) {
    send(res, 404, `not found: ${path}\n${err.message}`, "text/plain");
  }
}

// ---------------------------------------------------------------- host app
const hostServer = createServer(async (req, res) => {
  const url = new URL(req.url, hostOrigin);

  if (url.pathname === "/" || url.pathname === "/index.html") {
    const html = await readFile(join(here, "host.html"), "utf8");
    return send(
      res,
      200,
      html.replace("__SUPERSET_ORIGIN__", supersetOrigin),
    );
  }
  // The SDK exactly as a host app consumes it: the built UMD bundle.
  if (url.pathname === "/sdk.js") {
    return sendFile(res, join(sdkRoot, "bundle", "index.js"), "text/javascript");
  }
  if (url.pathname === "/sdk.js.map") {
    return sendFile(
      res,
      join(sdkRoot, "bundle", "index.js.map"),
      "application/json",
    );
  }
  // The host app's own guest-token endpoint. Counting the calls to it is how
  // the rig proves the SDK does not mint a token per stray navigation.
  if (url.pathname === "/guest-token") {
    const ttl = Number(url.searchParams.get("ttl") || 300);
    return send(
      res,
      200,
      JSON.stringify({ token: mintGuestToken(ttl) }),
      "application/json",
    );
  }
  if (url.pathname === "/stats") {
    return send(
      res,
      200,
      JSON.stringify({ tokensMinted: minted.length, minted }),
      "application/json",
    );
  }
  if (url.pathname === "/reset") {
    minted.length = 0;
    return send(res, 200, JSON.stringify({ ok: true }), "application/json");
  }
  return send(res, 404, "not found", "text/plain");
});

// ------------------------------------------------------------ fake superset
const supersetServer = createServer(async (req, res) => {
  const url = new URL(req.url, supersetOrigin);

  // What the SDK points the iframe at: /embedded/<uuid>
  if (url.pathname.startsWith("/embedded/")) {
    return sendFile(res, join(here, "embedded.html"), "text/html; charset=utf-8");
  }
  // A Superset page that is not the embedded one — what a link in a Markdown
  // chart can reach. It listens for nothing.
  if (url.pathname === "/plain") {
    return send(
      res,
      200,
      `<!doctype html><meta charset="utf-8"><title>a page that is not embedded</title>
       <body style="font:14px system-ui;padding:24px">
       <h1>Not the embedded page</h1>
       <p>No switchboard here. Nothing will answer the SDK's handshake.</p>
       <p><a id="back" href="/embedded/rig-dashboard?page=back">back to the dashboard</a></p>`,
    );
  }
  if (url.pathname === "/vendor/switchboard.js") {
    return sendFile(
      res,
      join(sdkRoot, "node_modules/@superset-ui/switchboard/esm/switchboard.js"),
      "text/javascript",
    );
  }
  return send(res, 404, "not found", "text/plain");
});

// Rejects, rather than hanging, when either port cannot be bound (typically a
// previous run still holding it), after closing whichever server did come up.
export async function start() {
  const servers = [
    [hostServer, HOST_PORT],
    [supersetServer, SUPERSET_PORT],
  ];
  const stop = () => {
    for (const [server] of servers) if (server.listening) server.close();
  };
  const outcomes = await Promise.allSettled(
    servers.map(
      ([server, port]) =>
        new Promise((resolve, reject) => {
          server.once("error", reject);
          server.listen(port, () => {
            server.off("error", reject);
            resolve();
          });
        }),
    ),
  );
  const failure = outcomes.find((o) => o.status === "rejected");
  if (failure) {
    stop();
    throw new Error(
      `the rig could not start: ${failure.reason.message} ` +
        "(set RIG_HOST_PORT / RIG_SUPERSET_PORT to use other ports)",
      { cause: failure.reason },
    );
  }
  return { hostOrigin, supersetOrigin, stop };
}

// `node server.mjs` runs the rig for a human; the driver imports `start`.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { hostOrigin: h } = await start();
  console.log(`test rig up:
  host app       ${h}
  fake superset  ${supersetOrigin}
open the host app and use the buttons. Ctrl-C to stop.`);
}
