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
 * ENABLE_VERSIONING_CAPTURE enabled (the docker dev stack does).
 *
 * The test creates its own chart and renames it twice via the authenticated
 * REST API to guarantee a deterministic, non-"first tracked save" entry, then
 * opens the Explore version-history panel and asserts the rendered entries —
 * exercising the descriptive-row rendering (no raw layout node ids / UUIDs
 * leaking into the timeline).
 *
 * It deliberately does not touch the seeded example charts. Renaming those
 * made the test order-dependent (it picked the most recently changed charts),
 * unsafe to run on parallel workers, and left version records behind that no
 * revert could remove — version history being append-only is the point.
 */
import { Page } from '@playwright/test';
import rison from 'rison';
import { testWithAssets, expect } from '../../helpers/fixtures';
import { apiGet } from '../../helpers/api/requests';
import { apiPostChart, apiPutChart } from '../../helpers/api/chart';
import { getDatasetByName } from '../../helpers/api/dataset';
import { TIMEOUT } from '../../utils/constants';

const DATASET_NAME = 'birth_names';

// Visible row text must never expose synthetic identifiers (layout node
// ids like CHART-xyz / ROW-… or bare UUIDs) — the rendering layer maps
// these to human names or kind-only phrasing.
const OPAQUE_ID =
  /\b(CHART|ROW|COLUMN|TAB|TABS|HEADER|MARKDOWN|DIVIDER|GRID)-|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/**
 * Resolve the current user's USER-type subject id. Chart `editors` (and the
 * `can_overwrite` gate derived from them) live in the Subject id space, not
 * the user id space.
 */
async function currentUserSubjectId(page: Page): Promise<number> {
  const meRes = await apiGet(page, 'api/v1/me/');
  expect(meRes.ok(), 'current user request').toBeTruthy();
  const userId = (await meRes.json()).result.id;

  const q = encodeURIComponent(
    `(filters:!((col:user_id,opr:eq,value:${userId})))`,
  );
  const res = await apiGet(page, `api/v1/security/subject/?q=${q}`);
  expect(res.ok(), 'subject lookup request').toBeTruthy();
  const subjects = (await res.json()).result;
  expect(
    subjects.length,
    `USER subject exists for user ${userId}`,
  ).toBeGreaterThan(0);
  return subjects[0].id;
}

/**
 * Any dataset will do: the chart exists only to carry version records, and
 * nothing here asserts on rendered data. Prefer the conventional example so
 * this reads like its sibling specs, but fall back to whatever the instance
 * has rather than requiring a particular fixture to be loaded.
 */
async function anyDatasetId(page: Page): Promise<number> {
  const named = await getDatasetByName(page, DATASET_NAME);
  if (named) {
    return named.id;
  }
  const res = await apiGet(
    page,
    `api/v1/dataset/?q=${rison.encode({ columns: ['id'], page_size: 1 })}`,
  );
  expect(res.ok(), 'dataset list request').toBeTruthy();
  const [first] = (await res.json()).result;
  expect(first, 'the instance has at least one dataset').toBeTruthy();
  return first.id;
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

testWithAssets(
  'chart activity log renders deterministic descriptive entries',
  async ({ page, testAssets }) => {
    testWithAssets.setTimeout(TIMEOUT.SLOW_TEST);

    const datasetId = await anyDatasetId(page);

    const baseName = `version_history_${Date.now()}`;
    const chartResp = await apiPostChart(page, {
      slice_name: baseName,
      viz_type: 'table',
      datasource_id: datasetId,
      datasource_type: 'table',
      // Raw mode with no column references, so the chart is valid against any
      // dataset.
      params: JSON.stringify({
        datasource: `${datasetId}__table`,
        viz_type: 'table',
        query_mode: 'raw',
        all_columns: [],
        adhoc_filters: [],
        row_limit: 10,
      }),
    });
    expect(chartResp.ok(), 'chart creation').toBeTruthy();
    const chartBody = await chartResp.json();
    const chartId: number = chartBody.result?.id ?? chartBody.id;
    expect(chartId, 'chart creation should return an id').toBeTruthy();
    testAssets.trackChart(chartId);

    // Version history is only offered on charts the user can overwrite, i.e.
    // can edit — so claim editorship. A chart created through the API starts
    // without editors.
    // Two renames: the first edit on an as-yet-untracked chart collapses into
    // "first tracked save"; the second is a normal descriptive save.
    const adminSubjectId = await currentUserSubjectId(page);
    await apiPutChart(page, chartId, {
      editors: [adminSubjectId],
      slice_name: `${baseName} ·vh1`,
    });
    await apiPutChart(page, chartId, { slice_name: `${baseName} ·vh2` });

    await page.goto(`explore/?slice_id=${chartId}`);
    await openVersionHistory(page);

    const panel = page.locator('[aria-label="Version history"]');
    const groups = panel.locator('[data-test="version-history-save-group"]');
    await expect(groups.first(), 'shows a save group').toBeVisible();

    // The newest save is the live one and is tagged "Current".
    await expect(panel.getByText('Current')).toBeVisible();

    // Expand the newest group and confirm the rename rendered as a descriptive
    // action row — not a raw field path.
    await groups.first().getByRole('button').first().click();
    const rows = panel.locator('[data-test="version-history-action-row"]');
    await expect(rows.first(), 'shows action rows').toBeVisible();
    await expect(panel.getByText(/Chart renamed to /).first()).toBeVisible();

    // No synthetic identifiers may surface in any visible timeline row.
    const panelText = (await panel.innerText()) ?? '';
    expect(
      OPAQUE_ID.test(panelText),
      `panel leaks a raw id/uuid:\n${panelText}`,
    ).toBeFalsy();
  },
);
