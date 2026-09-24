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

// Drives the rig in headless Chromium over the DevTools protocol, with no
// dependencies beyond a chromium binary. `node drive.mjs [--headed] [--verbose]`

import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync, existsSync, statSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { start, HOST_PORT } from "./server.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const sdkRoot = join(here, "..");
const headed = process.argv.includes("--headed");
const verbose = process.argv.includes("--verbose");

const CHROMIUM =
  process.env.CHROMIUM_PATH ||
  ["chromium", "chromium-browser", "google-chrome", "google-chrome-stable"].find(
    (bin) => {
      try {
        execFileSync("which", [bin], { stdio: "ignore" });
        return true;
      } catch {
        return false;
      }
    },
  );

// ------------------------------------------------------------------ results
const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  const mark = ok ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m";
  console.log(`  ${mark} ${name}${detail && !ok ? `\n      ${detail}` : ""}`);
}

// Waits for something to become true, and records the wait itself as a check,
// so a run against code that never gets there reports a failure per scenario
// instead of stopping at the first one.
async function expect(name, predicate, timeoutMs = 15_000) {
  try {
    await waitFor(predicate, name, timeoutMs);
    check(name, true);
    return true;
  } catch (err) {
    check(name, false, err.message);
    return false;
  }
}

// ---------------------------------------------------------------- cdp client
class CDP {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 0;
    this.pending = new Map();
    this.listeners = [];
    ws.addEventListener("message", (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result);
      } else {
        this.listeners.forEach((fn) => fn(msg));
      }
    });
  }

  send(method, params = {}, sessionId) {
    const id = (this.nextId += 1);
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    this.ws.send(JSON.stringify(payload));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      setTimeout(() => {
        if (this.pending.delete(id)) reject(new Error(`${method} timed out`));
      }, 30_000);
    });
  }
}

async function launchBrowser() {
  const userDataDir = mkdtempSync(join(tmpdir(), "embedded-sdk-rig-"));
  const args = [
    ...(headed ? [] : ["--headless=new"]),
    "--remote-debugging-port=0",
    `--user-data-dir=${userDataDir}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "about:blank",
  ];
  const child = spawn(CHROMIUM, args, { stdio: ["ignore", "pipe", "pipe"] });
  const wsUrl = await new Promise((resolve, reject) => {
    let buffered = "";
    const onChunk = (chunk) => {
      buffered += chunk;
      const match = buffered.match(/ws:\/\/\S+/);
      if (match) resolve(match[0]);
    };
    child.stdout.on("data", onChunk);
    child.stderr.on("data", onChunk);
    child.on("exit", (code) =>
      reject(new Error(`chromium exited (${code}) before listening:\n${buffered}`)),
    );
    setTimeout(() => reject(new Error("chromium never reported a devtools url")), 20_000);
  });
  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });
  return {
    cdp: new CDP(ws),
    stop: () => {
      try {
        child.kill("SIGKILL");
      } finally {
        rmSync(userDataDir, { recursive: true, force: true });
      }
    },
  };
}

// ------------------------------------------------------------------- a page
async function openPage(cdp, url) {
  const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await cdp.send("Target.attachToTarget", {
    targetId,
    flatten: true,
  });
  await cdp.send("Runtime.enable", {}, sessionId);
  await cdp.send("Page.enable", {}, sessionId);
  if (verbose) {
    cdp.listeners.push((msg) => {
      if (msg.method === "Runtime.consoleAPICalled" && msg.sessionId === sessionId) {
        const text = msg.params.args
          .map((a) => a.value ?? a.description ?? a.type)
          .join(" ");
        console.log(`      [page] ${text}`);
      }
    });
  }

  const evaluate = async (expression) => {
    const r = await cdp.send(
      "Runtime.evaluate",
      { expression, awaitPromise: true, returnByValue: true },
      sessionId,
    );
    if (r.exceptionDetails) {
      throw new Error(
        r.exceptionDetails.exception?.description ||
          r.exceptionDetails.text ||
          JSON.stringify(r.exceptionDetails),
      );
    }
    return r.result.value;
  };

  await cdp.send("Page.navigate", { url }, sessionId);
  // Wait for the host app's own globals rather than a load event.
  await waitFor(
    () => evaluate("typeof window.rig === 'object' && !!window.supersetEmbeddedSdk"),
    "the host app to load",
  );
  return { evaluate, sessionId };
}

async function waitFor(predicate, what, timeoutMs = 15_000, intervalMs = 100) {
  const deadline = Date.now() + timeoutMs;
  let last;
  for (;;) {
    last = await predicate();
    if (last) return last;
    if (Date.now() > deadline) {
      throw new Error(`timed out waiting for ${what}`);
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ------------------------------------------------------------------ helpers
function makeHelpers(evaluate) {
  return {
    evaluate,
    click: (id) => evaluate(`document.getElementById(${JSON.stringify(id)}).click()`),
    events: () => evaluate("window.rig.events"),
    errors: () => evaluate("window.rig.errors"),
    tokensMinted: () => evaluate("window.rigRefreshStats().then(s => s.tokensMinted)"),
    navigateGuest: (to) => evaluate(`window.rigNavigateGuest(${JSON.stringify(to)})`),
    embedState: () => evaluate("window.rig.embedState"),
    releaseFirstToken: () => evaluate("window.rigReleaseFirstToken()"),
    failFirstToken: () => evaluate("window.rigFailFirstToken()"),
    heldFirstFetch: () => evaluate("!!window.rig.heldFirstFetch"),
    hasIframe: () => evaluate("!!document.querySelector('#mount iframe')"),
    getActiveTabs: () => evaluate("window.rigGetActiveTabs()"),
    // Events the embedded page reported from a given page of the dashboard.
    eventsOn: async (page, name) =>
      (await evaluate("window.rig.events")).filter(
        (e) => e.page === String(page) && (!name || e.event === name),
      ),
  };
}

// ----------------------------------------------------------------- the runs
async function mainRun(cdp, hostOrigin) {
  console.log("\n\x1b[1mmain run\x1b[0m (300s tokens)");
  const { evaluate } = await openPage(cdp, `${hostOrigin}/`);
  const h = makeHelpers(evaluate);

  // -- 1. the ordinary first embed -----------------------------------------
  await h.click("embed");
  await expect(
    "first load: the embedded page renders with a guest token",
    async () => (await h.eventsOn(1, "guestToken")).length === 1,
  );
  check(
    "first load: exactly one token minted",
    (await h.tokensMinted()) === 1,
    `minted ${await h.tokensMinted()}`,
  );

  // -- 2. the bug this PR is about ------------------------------------------
  await evaluate("window.rig.dashboard.setThemeConfig({token:{colorPrimary:'#ff0066'}})");
  await evaluate("window.rig.dashboard.setThemeMode('dark')");
  await expect(
    "first load: the host's theme reaches the document",
    async () => (await h.eventsOn(1, "setThemeMode")).length === 1,
  );

  await h.navigateGuest("/embedded/rig-dashboard?page=2");
  await expect(
    "internal navigation: the new document is re-authenticated",
    async () => (await h.eventsOn(2, "guestToken")).length === 1,
  );
  check(
    "internal navigation: one further token minted, not more",
    (await h.tokensMinted()) === 2,
    `minted ${await h.tokensMinted()}`,
  );

  // The finding this round of fixes came from: methods were replayed, state
  // was not, so the dashboard came back in the default theme.
  await expect(
    "internal navigation: the host's theme is re-applied",
    async () => (await h.eventsOn(2, "setThemeMode")).length === 1,
  );
  const page2 = (await h.eventsOn(2)).map((e) => e.event);
  check(
    "internal navigation: the token arrives before the theme",
    page2.indexOf("guestToken") < page2.indexOf("setThemeConfig"),
    page2.join(" → "),
  );
  check(
    "internal navigation: the dark theme is actually on the new document",
    await evaluate(
      "document.querySelector('#mount iframe') && window.rig.events.some(e => e.page==='2' && e.event==='setThemeMode' && e.detail.mode==='dark')",
    ),
  );

  // -- 3. a call in flight when the document leaves --------------------------
  await h.navigateGuest("/embedded/rig-dashboard?page=3&hang=1");
  await expect(
    "a page that answers nothing still gets its token",
    async () => (await h.eventsOn(3, "guestToken")).length === 1,
  );
  await h.click("tabs"); // page 3 never answers this
  await sleep(300);
  await h.navigateGuest("/embedded/rig-dashboard?page=4");
  const rejected = await expect(
    "a call in flight when the user navigates is rejected, not left hanging",
    async () => (await h.errors()).length === 1,
  );
  if (rejected) {
    const [err] = await h.errors();
    check(
      "…and it is rejected as a PortClosedError",
      err.name === "PortClosedError",
      JSON.stringify(err),
    );
  }

  // -- 4. a navigation that does not land on the embedded page --------------
  const beforeStray = await h.tokensMinted();
  await h.navigateGuest("/plain");
  // The handshake probe gives the new document 5s to answer.
  await sleep(7000);
  check(
    "a navigation away from the embedded page mints no guest token",
    (await h.tokensMinted()) === beforeStray,
    `minted ${await h.tokensMinted()}, was ${beforeStray}`,
  );

  // -- 5. and back again ----------------------------------------------------
  // The stray page cannot navigate itself back for us, so the host reloads the
  // frame the way a host app would.
  await evaluate(
    "document.querySelector('#mount iframe').src = '__SUPERSET__/embedded/rig-dashboard?page=5&hang=1'".replace(
      "__SUPERSET__",
      await evaluate("SUPERSET_ORIGIN"),
    ),
  );
  await expect(
    "coming back to the embedded page re-authenticates again",
    async () => (await h.eventsOn(5, "guestToken")).length === 1,
  );
  check(
    "coming back mints exactly one more token",
    (await h.tokensMinted()) === beforeStray + 1,
    `minted ${await h.tokensMinted()}, was ${beforeStray}`,
  );

  // -- 6. unmount -----------------------------------------------------------
  // Page 5 answers nothing either, so this call is still in flight.
  await h.click("tabs");
  await sleep(200);
  await evaluate("window.rig.dashboard.unmount()");
  if (
    await expect(
      "unmount rejects what is still in flight",
      async () => (await h.errors()).length === 2,
    )
  ) {
    const errs = await h.errors();
    check(
      "…and it too is a PortClosedError",
      errs[1].name === "PortClosedError",
      JSON.stringify(errs[1]),
    );
  }
  const afterUnmount = await h.tokensMinted();
  await sleep(1000);
  check(
    "nothing is minted after unmount",
    (await h.tokensMinted()) === afterUnmount,
  );
}

async function refreshRun(cdp, hostOrigin) {
  console.log("\n\x1b[1mrefresh run\x1b[0m (15s tokens, so the timer fires during the run)");
  await fetch(`${hostOrigin}/reset`);
  const { evaluate } = await openPage(cdp, `${hostOrigin}/?ttl=15`);
  const h = makeHelpers(evaluate);

  await h.click("embed");
  await expect(
    "refresh run: the first token arrives",
    async () => (await h.eventsOn(1, "guestToken")).length === 1,
  );
  await h.navigateGuest("/embedded/rig-dashboard?page=2");
  await expect(
    "refresh run: the navigated-to page is authenticated",
    async () => (await h.eventsOn(2, "guestToken")).length === 1,
  );
  const mintedAfterNav = await h.tokensMinted();

  // A 15s token refreshes 5s before it expires, so ~10s from when it was
  // issued. The point is which port that refresh lands on.
  await expect(
    "the refresh timer follows the current document",
    async () => (await h.eventsOn(2, "guestToken")).length === 2,
    20_000,
  );
  check(
    "the old document gets nothing",
    (await h.eventsOn(1, "guestToken")).length === 1,
  );
  check(
    "exactly one refresh, so there is only one timer chain",
    (await h.tokensMinted()) === mintedAfterNav + 1,
    `minted ${await h.tokensMinted()}, was ${mintedAfterNav}`,
  );
  await evaluate("window.rig.dashboard?.unmount()");
}


// The two directions of the race between the very first token fetch and a
// navigation the dashboard makes while that fetch is still in flight. Neither
// is reachable with a host endpoint that answers promptly, so the rig holds
// the first fetch open and settles it by hand.
async function staleInitialFetchRun(cdp, hostOrigin) {
  console.log(
    "\n\x1b[1mstale initial fetch run\x1b[0m (the first fetch fails after a navigation already recovered the embed)",
  );
  await fetch(`${hostOrigin}/reset`);
  const { evaluate } = await openPage(cdp, `${hostOrigin}/?slowfirst=1`);
  const h = makeHelpers(evaluate);

  await h.click("embed");
  // The frame is up and page 1 is blank, waiting for a token that the rig is
  // sitting on.
  await expect("stale initial fetch: the first fetch is in flight", h.heldFirstFetch);
  await expect(
    "stale initial fetch: the first document is still waiting for a token",
    async () => (await h.eventsOn(1, "started")).length === 1,
  );
  check(
    "stale initial fetch: …and has not been given one",
    (await h.eventsOn(1, "guestToken")).length === 0,
  );

  // The user clicks a link before the host's endpoint has answered.
  await h.navigateGuest("/embedded/rig-dashboard?page=2");
  await expect(
    "stale initial fetch: the navigated-to document authenticates on its own",
    async () => (await h.eventsOn(2, "guestToken")).length === 1,
  );
  const mintedWhileWorking = await h.tokensMinted();

  // Only now does the original fetch give up. Nobody is waiting for it.
  await h.failFirstToken();
  await sleep(500);

  check(
    "stale initial fetch: the working dashboard is not torn down",
    await h.hasIframe(),
  );
  check(
    "stale initial fetch: embedDashboard resolves rather than rejecting",
    (await h.embedState()) === "resolved",
    `embedState = ${await h.embedState()}`,
  );
  // The surest proof the embed is still live: the port still answers, with the
  // navigated-to document's own answer.
  const tabs = await h.getActiveTabs();
  check(
    "stale initial fetch: the port still answers, from the current document",
    tabs.ok && tabs.tabs?.[0] === "tab-on-page-2",
    JSON.stringify(tabs),
  );
  check(
    "stale initial fetch: the failure mints nothing further",
    (await h.tokensMinted()) === mintedWhileWorking,
    `minted ${await h.tokensMinted()}, was ${mintedWhileWorking}`,
  );
  await evaluate("window.rig.dashboard?.unmount()");
}

async function supersededTokenRun(cdp, hostOrigin) {
  console.log(
    "\n\x1b[1msuperseded token run\x1b[0m (the navigation's own fetch fails, the first one succeeds late)",
  );
  await fetch(`${hostOrigin}/reset`);
  // Call #1 is held; call #2 — the one the navigation triggers — rejects.
  const { evaluate } = await openPage(cdp, `${hostOrigin}/?slowfirst=1&failnth=2`);
  const h = makeHelpers(evaluate);

  await h.click("embed");
  await expect("superseded token: the first fetch is in flight", h.heldFirstFetch);
  // The first document has to be listening before it can be told to navigate:
  // the held fetch starts before the iframe has loaded.
  await expect(
    "superseded token: the first document is up and waiting for a token",
    async () => (await h.eventsOn(1, "started")).length === 1,
  );

  await h.navigateGuest("/embedded/rig-dashboard?page=2");
  // The navigation's own fetch fails, so page 2 is blank and a retry is armed
  // ten seconds out.
  await expect(
    "superseded token: the navigated-to document reaches the handshake",
    async () => (await h.eventsOn(2, "started")).length === 1,
  );
  await expect(
    "superseded token: its own fetch failed, so it has no token yet",
    async () => (await evaluate("window.rig.tokenFetches")) === 2,
  );
  check(
    "superseded token: …and the document is still blank",
    (await h.eventsOn(2, "guestToken")).length === 0,
  );

  // The first fetch finally answers. Its token is superseded but perfectly
  // valid, and the document in front of the user has none.
  await h.releaseFirstToken();
  // Well inside the 10s retry interval: holding the token back until the failed
  // cycle retries is exactly the blank page this is about, so a token that only
  // turns up on the retry is not a pass.
  await expect(
    "superseded token: the superseded token is handed straight to the current document",
    async () => (await h.eventsOn(2, "guestToken")).length === 1,
    3_000,
  );
  check(
    "superseded token: nothing is sent to the document that is gone",
    (await h.eventsOn(1, "guestToken")).length === 0,
  );
  check(
    "superseded token: one token minted, not a second for the retry",
    (await h.tokensMinted()) === 1,
    `minted ${await h.tokensMinted()}`,
  );
  check(
    "superseded token: embedDashboard resolves",
    (await h.embedState()) === "resolved",
    `embedState = ${await h.embedState()}`,
  );
  await evaluate("window.rig.dashboard?.unmount()");
}

// --------------------------------------------------------------------- main
function buildIfStale() {
  const bundle = join(sdkRoot, "bundle", "index.js");
  const newestSrc = Math.max(
    ...readdirSync(join(sdkRoot, "src")).map((f) =>
      statSync(join(sdkRoot, "src", f)).mtimeMs,
    ),
  );
  if (existsSync(bundle) && statSync(bundle).mtimeMs > newestSrc) return;
  console.log("building the sdk bundle…");
  execFileSync("npx", ["webpack", "--mode", "development"], {
    cwd: sdkRoot,
    stdio: verbose ? "inherit" : "ignore",
  });
}

async function main() {
  if (!CHROMIUM) {
    console.error(
      "no chromium found. Install one, or set CHROMIUM_PATH to a chrome binary.",
    );
    process.exit(2);
  }
  buildIfStale();
  const server = await start();
  const browser = await launchBrowser();
  try {
    await mainRun(browser.cdp, server.hostOrigin);
    await refreshRun(browser.cdp, server.hostOrigin);
    await staleInitialFetchRun(browser.cdp, server.hostOrigin);
    await supersededTokenRun(browser.cdp, server.hostOrigin);
  } finally {
    browser.stop();
    server.stop();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(
    `\n${results.length - failed.length}/${results.length} checks passed`,
  );
  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => {
  console.error("\nrig failed:", err);
  process.exit(1);
});
