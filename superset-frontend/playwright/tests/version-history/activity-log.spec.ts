/**
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

/**
 * Activity-log (version history) coverage for charts.
 *
 * Requires the running instance to have VERSION_HISTORY +
 * ENABLE_VERSIONING_CAPTURE enabled (the docker dev stack does). Each
 * target chart is renamed twice via the authenticated REST API to
 * guarantee a deterministic, non-"first tracked save" entry, then the
 * Explore version-history panel is opened and its rendered entries are
 * asserted — exercising the descriptive-row rendering (no raw layout
 * node ids / UUIDs leaking into the timeline).
 */
import { test, expect, APIRequestContext, Page } from '@playwright/test';

// Visible row text must never expose synthetic identifiers (layout node
// ids like CHART-xyz / ROW-… or bare UUIDs) — the rendering layer maps
// these to human names or kind-only phrasing.
const OPAQUE_ID =
  /\b(CHART|ROW|COLUMN|TAB|TABS|HEADER|MARKDOWN|DIVIDER|GRID)-|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

async function csrfToken(request: APIRequestContext): Promise<string> {
  const res = await request.get('/api/v1/security/csrf_token/');
  expect(res.ok(), 'csrf token request').toBeTruthy();
  return (await res.json()).result;
}

/**
 * Resolve the current user's USER-type subject id. Chart `editors` (and the
 * `can_overwrite` gate derived from them) live in the Subject id space, not
 * the user id space.
 */
async function currentUserSubjectId(
  request: APIRequestContext,
): Promise<number> {
  const meRes = await request.get('/api/v1/me/');
  expect(meRes.ok(), 'current user request').toBeTruthy();
  const userId = (await meRes.json()).result.id;

  const q = encodeURIComponent(
    `(filters:!((col:user_id,opr:eq,value:${userId})))`,
  );
  const res = await request.get(`/api/v1/security/subject/?q=${q}`);
  expect(res.ok(), 'subject lookup request').toBeTruthy();
  const subjects = (await res.json()).result;
  expect(
    subjects.length,
    `USER subject exists for user ${userId}`,
  ).toBeGreaterThan(0);
  return subjects[0].id;
}

/** First few charts (id + name) the API exposes. */
async function listCharts(
  request: APIRequestContext,
  limit: number,
): Promise<Array<{ id: number; slice_name: string }>> {
  const q = encodeURIComponent(
    `(columns:!(id,slice_name),page_size:${limit},order_column:changed_on_delta_humanized,order_direction:desc)`,
  );
  const res = await request.get(`/api/v1/chart/?q=${q}`);
  expect(res.ok(), 'chart list request').toBeTruthy();
  return (await res.json()).result;
}

async function updateChart(
  request: APIRequestContext,
  csrf: string,
  id: number,
  data: Record<string, unknown>,
): Promise<void> {
  const res = await request.put(`/api/v1/chart/${id}`, {
    headers: { 'X-CSRFToken': csrf, 'Content-Type': 'application/json' },
    data,
  });
  expect(res.ok(), `update chart ${id}: ${JSON.stringify(data)}`).toBeTruthy();
}

/** The chart's current editor subject ids, for restoring after the test. */
async function chartEditors(
  request: APIRequestContext,
  id: number,
): Promise<number[]> {
  const res = await request.get(`/api/v1/chart/${id}`);
  expect(res.ok(), `fetch chart ${id}`).toBeTruthy();
  const editors: Array<{ id: number } | number> =
    (await res.json()).result.editors ?? [];
  return editors.map(editor =>
    typeof editor === 'number' ? editor : editor.id,
  );
}

/** Open the Explore "Additional actions → View version history" panel. */
async function openVersionHistory(page: Page): Promise<void> {
  await page.locator('[data-test="actions-trigger"]').click();
  await page.getByRole('menuitem', { name: 'View version history' }).click();
  await expect(
    page.locator('[aria-label="Version history"]'),
    'version history panel opens',
  ).toBeVisible();
}

test('chart activity log renders deterministic descriptive entries for multiple charts', async ({
  page,
}) => {
  const charts = await listCharts(page.request, 3);
  expect(charts.length, 'at least one chart exists').toBeGreaterThan(0);

  const csrf = await csrfToken(page.request);
  const adminSubjectId = await currentUserSubjectId(page.request);

  for (const chart of charts) {
    const original = chart.slice_name;
    const originalEditors = await chartEditors(page.request, chart.id);
    try {
      // Version history is only offered on charts the user can overwrite,
      // i.e. can edit — so claim editorship first (example charts ship
      // without editors).
      // Two renames: the first edit on an as-yet-untracked chart collapses
      // into "first tracked save"; the second is a normal descriptive save.
      await updateChart(page.request, csrf, chart.id, {
        editors: [adminSubjectId],
        slice_name: `${original} ·vh1`,
      });
      await updateChart(page.request, csrf, chart.id, {
        slice_name: `${original} ·vh2`,
      });

      await page.goto(`explore/?slice_id=${chart.id}`);
      await openVersionHistory(page);

      const groups = page.locator('[data-test="version-history-save-group"]');
      await expect(
        groups.first(),
        `chart ${chart.id} shows a save group`,
      ).toBeVisible();

      // The newest save is the live one and is tagged "Current".
      await expect(
        page.locator('[aria-label="Version history"]').getByText('Current'),
      ).toBeVisible();

      // Expand the newest group and confirm the rename rendered as a
      // descriptive action row — not a raw field path.
      await groups.first().getByRole('button').first().click();
      const rows = page.locator('[data-test="version-history-action-row"]');
      await expect(
        rows.first(),
        `chart ${chart.id} shows action rows`,
      ).toBeVisible();
      await expect(page.getByText(/Chart renamed to /).first()).toBeVisible();

      // No synthetic identifiers may surface in any visible timeline row.
      const panelText =
        (await page.locator('[aria-label="Version history"]').innerText()) ??
        '';
      expect(
        OPAQUE_ID.test(panelText),
        `chart ${chart.id} panel leaks a raw id/uuid:\n${panelText}`,
      ).toBeFalsy();
    } finally {
      // Restore the original name and editorship even when an assertion
      // fails mid-loop, so the shared fixtures stay clean for re-runs.
      // Plain request (no assertion) — a failed restore must not mask the
      // original test failure.
      await page.request.put(`/api/v1/chart/${chart.id}`, {
        headers: { 'X-CSRFToken': csrf, 'Content-Type': 'application/json' },
        data: { slice_name: original, editors: originalEditors },
      });
    }
  }
});
