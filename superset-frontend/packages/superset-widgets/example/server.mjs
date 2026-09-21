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

// Local-only guest-token broker. A real broker must authenticate the host
// app's own user first and add RLS rules scoped to that user.
import http from "node:http";

try {
  process.loadEnvFile(new URL(".env", import.meta.url));
} catch {
  // No .env file: use the process environment as-is.
}

const SUPERSET_URL = (process.env.SUPERSET_URL ?? "http://localhost:8088").replace(/\/+$/, "");
const USERNAME = process.env.SUPERSET_USERNAME ?? "admin";
const PASSWORD = process.env.SUPERSET_PASSWORD ?? "admin";
const PORT = Number(process.env.BROKER_PORT ?? 3001);

const list = (value) =>
  (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

async function supersetJson(path, init, what) {
  const response = await fetch(`${SUPERSET_URL}${path}`, init);
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${what} failed: ${response.status} ${text.slice(0, 300)}`);
  }
  return { response, body: text ? JSON.parse(text) : {} };
}

async function mintGuestToken() {
  const { body: login } = await supersetJson(
    "/api/v1/security/login",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: USERNAME, password: PASSWORD, provider: "db", refresh: false }),
    },
    "Superset login",
  );
  const headers = {
    Authorization: `Bearer ${login.access_token}`,
    "Content-Type": "application/json",
    Referer: SUPERSET_URL,
  };

  // guest_token is CSRF-protected unless WTF_CSRF_ENABLED is off; the CSRF
  // token is bound to the session cookie issued with it.
  try {
    const { response, body } = await supersetJson(
      "/api/v1/security/csrf_token/",
      { headers: { Authorization: headers.Authorization } },
      "CSRF token",
    );
    headers["X-CSRFToken"] = body.result;
    const cookies = response.headers.getSetCookie().map((cookie) => cookie.split(";")[0]);
    if (cookies.length > 0) headers.Cookie = cookies.join("; ");
  } catch (err) {
    console.warn(`Continuing without a CSRF token: ${err.message}`);
  }

  const { body } = await supersetJson(
    "/api/v1/security/guest_token/",
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        user: { username: "widgets-demo", first_name: "Widgets", last_name: "Demo" },
        // Saved widgets are granted by id; inline widgets by dataset.
        resources: list(process.env.EMBED_WIDGET_IDS).map((id) => ({ type: "widget", id })),
        datasets: list(process.env.EMBED_DATASETS).map(Number),
        rls: [],
      }),
    },
    "Guest token",
  );
  return body.token;
}

http
  .createServer(async (req, res) => {
    if (req.method !== "POST" || !req.url?.startsWith("/api/guest-token")) {
      res.writeHead(404).end();
      return;
    }
    try {
      res.writeHead(200, { "Content-Type": "text/plain" }).end(await mintGuestToken());
    } catch (err) {
      console.error(err);
      res.writeHead(502, { "Content-Type": "text/plain" }).end(err.message);
    }
  })
  .listen(PORT, "127.0.0.1", () => {
    console.log(`Guest-token broker on http://127.0.0.1:${PORT} (Superset: ${SUPERSET_URL})`);
  });
