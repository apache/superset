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
import { Locator, Page } from '@playwright/test';
import rison from 'rison';
import { testWithAssets, expect, TestAssets } from '../../helpers/fixtures';
import { skipUnlessFeatureEnabled } from '../../helpers/featureFlags';
import { apiGet } from '../../helpers/api/requests';
import { apiPostChart, apiPutChart } from '../../helpers/api/chart';
import { getDatasetByName } from '../../helpers/api/dataset';
import { getAccessToken } from '../../helpers/api/embedded';
import { TIMEOUT } from '../../utils/constants';

const DATASET_NAME = 'birth_names';

async function authorizeApi(page: Page): Promise<void> {
  const accessToken = await getAccessToken(page);
  await page.context().setExtraHTTPHeaders({
    Authorization: `Bearer ${accessToken}`,
  });
}

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
async function anyDataset(page: Page): Promise<{
  id: number;
  columnName: string;
}> {
  const named = await getDatasetByName(page, DATASET_NAME);
  let datasetId = named?.id;
  if (!datasetId) {
    const res = await apiGet(
      page,
      `api/v1/dataset/?q=${rison.encode({ columns: ['id'], page_size: 1 })}`,
    );
    expect(res.ok(), 'dataset list request').toBeTruthy();
    const [first] = (await res.json()).result;
    expect(first, 'the instance has at least one dataset').toBeTruthy();
    datasetId = first.id;
  }
  if (datasetId === undefined) {
    throw new Error('Unable to resolve a dataset id');
  }

  const detailRes = await apiGet(page, `api/v1/dataset/${datasetId}`);
  expect(detailRes.ok(), 'dataset detail request').toBeTruthy();
  const { columns } = (await detailRes.json()).result;
  const [firstColumn] = columns;
  expect(firstColumn, 'the dataset has at least one column').toBeTruthy();
  return {
    id: datasetId,
    columnName: firstColumn.column_name,
  };
}

/** Hidden overflow must not be scrolled by Playwright to expose a control. */
async function expectNoAppScroll(page: Page): Promise<void> {
  expect(
    await page.locator('#app').evaluate(element => element.scrollLeft),
  ).toBe(0);
}

/** Inspect the whole control before clicking, including portalled menus. */
async function expectControlInViewport(control: Locator): Promise<void> {
  await expect(control).toBeVisible();
  const bounds = await control.evaluate(element => {
    const rect = element.getBoundingClientRect();
    return {
      left: rect.left,
      right: rect.right,
      top: rect.top,
      bottom: rect.bottom,
      width: window.innerWidth,
      height: window.innerHeight,
    };
  });
  expect(bounds.left).toBeGreaterThanOrEqual(0);
  expect(bounds.right).toBeLessThanOrEqual(bounds.width + 1);
  expect(bounds.top).toBeGreaterThanOrEqual(0);
  expect(bounds.bottom).toBeLessThanOrEqual(bounds.height + 1);
}

/** A real click must work without moving the hidden horizontal scrollport. */
async function clickWithoutScroll(page: Page, control: Locator): Promise<void> {
  await expectNoAppScroll(page);
  await expectControlInViewport(control);
  await control.click({ timeout: 5000 });
  await expectNoAppScroll(page);
}

/** Open the Explore "Additional actions → View version history" panel. */
async function openVersionHistory(page: Page): Promise<void> {
  await clickWithoutScroll(page, page.getByTestId('actions-trigger'));
  await clickWithoutScroll(
    page,
    page.getByRole('menuitem', { name: 'View version history' }),
  );
  await expect(
    page.getByRole('complementary', { name: 'Version history' }),
    'version history panel opens',
  ).toBeVisible();
}

/** Read the layout in one frame, before any click can scroll hidden overflow. */
async function measureHistoryLayout(page: Page) {
  return page.evaluate(() => {
    const rect = (selector: string) => {
      const box = document.querySelector(selector)?.getBoundingClientRect();
      return box
        ? {
            left: box.left,
            right: box.right,
            top: box.top,
            bottom: box.bottom,
            width: box.width,
          }
        : null;
    };
    const app = document.querySelector('#app');
    return {
      width: window.innerWidth,
      height: window.innerHeight,
      appScroll: app?.scrollLeft,
      appScrollWidth: app?.scrollWidth,
      content: rect('#explore-container'),
      chart: rect('.main-explore-content'),
      datasourceRail: rect('.data-source-selection'),
      controlsRail: rect('.controls-column'),
      panel: rect('aside[aria-label="Version history"]'),
      close: rect('button[aria-label="Close version history"]'),
      headerActions: rect('[data-test="actions-trigger"]'),
    };
  });
}

/** Wait for the resized viewport to be painted, without polling its geometry. */
async function resizeExplore(page: Page, width: number): Promise<void> {
  await page.setViewportSize({ width, height: 1000 });
  await page.evaluate(
    () => new Promise<void>(resolve => requestAnimationFrame(() => resolve())),
  );
}

/** Missing captured saves are a setup failure, not a reason to skip coverage. */
async function historicalGroup(page: Page): Promise<Locator> {
  const groups = page
    .getByRole('complementary', { name: 'Version history' })
    .getByTestId('version-history-save-group');
  await expect(
    groups.nth(1),
    'successive saves require ENABLE_VERSIONING_CAPTURE on the server',
  ).toBeVisible();
  const group = groups.nth(1);
  await expect(group.getByRole('button', { name: 'More actions' })).toHaveCount(
    1,
  );
  return group;
}

/** Search must settle on the server while preserving the horizontal position. */
async function searchHistory(page: Page, query: string): Promise<void> {
  const search = page.getByRole('textbox', { name: 'Search actions' });
  await expectNoAppScroll(page);
  await expectControlInViewport(search);
  const response = page.waitForResponse(res => {
    const url = new URL(res.url());
    return (
      url.pathname.endsWith('/activity/') && url.searchParams.get('q') === query
    );
  });
  await search.fill(query);
  expect((await response).ok(), 'history search').toBeTruthy();
  await expectNoAppScroll(page);
}

/** Create a disposable editable chart with successive captured saves. */
async function createHistoryChart(
  page: Page,
  testAssets: TestAssets,
): Promise<number> {
  const { id: datasetId, columnName } = await anyDataset(page);

  const baseName = `version_history_${Date.now()}_${testWithAssets.info().workerIndex}`;
  const chartResp = await apiPostChart(page, {
    slice_name: baseName,
    viz_type: 'table',
    datasource_id: datasetId,
    datasource_type: 'table',
    // Use a real column so historical preview can query the dataset.
    params: JSON.stringify({
      datasource: `${datasetId}__table`,
      viz_type: 'table',
      query_mode: 'raw',
      all_columns: [columnName],
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
  const firstSave = await apiPutChart(page, chartId, {
    editors: [adminSubjectId],
    slice_name: `${baseName} ·vh1`,
  });
  expect(firstSave.ok(), 'first chart save').toBeTruthy();
  const secondSave = await apiPutChart(page, chartId, {
    slice_name: `${baseName} ·vh2`,
  });
  expect(secondSave.ok(), 'second chart save').toBeTruthy();
  return chartId;
}

testWithAssets(
  'chart activity log renders deterministic descriptive entries',
  async ({ page, testAssets }) => {
    testWithAssets.setTimeout(TIMEOUT.SLOW_TEST);

    await authorizeApi(page);
    const chartId = await createHistoryChart(page, testAssets);

    await page.goto(`explore/?slice_id=${chartId}`);
    await openVersionHistory(page);

    const panel = page.locator('[aria-label="Version history"]');
    const groups = panel.locator('[data-test="version-history-save-group"]');
    await expect(groups.first(), 'shows a save group').toBeVisible();

    // The newest save is the live one. With no unsaved changes there is no
    // "Current version" section, so the live save is the single row marked
    // current, by aria-current rather than a visible tag.
    await expect(
      panel.getByRole('button', { name: 'Current version' }),
    ).toHaveCount(0);
    await expect(panel.locator('[aria-current="true"]')).toHaveCount(1);
    await expect(
      groups.first().locator('[role="button"][aria-current="true"]'),
    ).toHaveAttribute('tabindex', '0');
    await expect(groups.first().getByText('Latest save')).toBeVisible();
    await expect(panel.getByText('Current', { exact: true })).toHaveCount(0);

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

testWithAssets(
  'minor edit of a non-canonical chart omits hydration noise',
  async ({ page, testAssets }) => {
    testWithAssets.setTimeout(TIMEOUT.SLOW_TEST);

    await authorizeApi(page);
    const { id: datasetId, columnName } = await anyDataset(page);
    const baseName = `version_history_normalization_${Date.now()}`;
    const chartResp = await apiPostChart(page, {
      slice_name: baseName,
      viz_type: 'table',
      datasource_id: datasetId,
      datasource_type: 'table',
      // Deliberately omit visualization defaults. Explore hydration supplies
      // them, reproducing params imported before they were canonical.
      params: JSON.stringify({
        datasource: `${datasetId}__table`,
        viz_type: 'table',
        query_mode: 'raw',
        all_columns: [columnName],
        adhoc_filters: [],
        extra_form_data: {},
        dashboards: [],
        row_limit: 10,
      }),
    });
    expect(chartResp.ok(), 'chart creation').toBeTruthy();
    const chartBody = await chartResp.json();
    const chartId: number = chartBody.result?.id ?? chartBody.id;
    expect(chartId, 'chart creation should return an id').toBeTruthy();
    testAssets.trackChart(chartId);

    const adminSubjectId = await currentUserSubjectId(page);
    const editorResp = await apiPutChart(page, chartId, {
      editors: [adminSubjectId],
    });
    expect(editorResp.ok(), 'claim chart editorship').toBeTruthy();

    await page.goto(`explore/?slice_id=${chartId}`);
    await page.getByRole('combobox', { name: 'Row limit' }).click();
    await page.getByRole('option', { name: '100', exact: true }).click();
    await page.locator('[data-test="query-save-button"]').click();
    await page.locator('[data-test="save-overwrite-radio"]').click();

    const saveResponsePromise = page.waitForResponse(
      response =>
        response.request().method() === 'PUT' &&
        response.url().includes(`/api/v1/chart/${chartId}`),
    );
    await page.locator('[data-test="btn-modal-save"]').click();
    const saveResponse = await saveResponsePromise;
    expect(saveResponse.ok(), 'chart overwrite').toBeTruthy();

    const requestPayload = saveResponse.request().postDataJSON();
    const savedParams = JSON.parse(requestPayload.params);
    expect(
      savedParams.matrixify_enable,
      'overwrite contains a default absent from the stored params',
    ).toBe(false);

    await openVersionHistory(page);
    const panel = page.locator('[aria-label="Version history"]');
    const newestGroup = panel
      .locator('[data-test="version-history-save-group"]')
      .first();
    await expect(newestGroup, 'shows the overwrite save group').toBeVisible();
    await newestGroup.getByRole('button').first().click();

    const rows = newestGroup.locator(
      '[data-test="version-history-action-row"]',
    );
    await expect(rows, 'shows only the intentional edit').toHaveCount(1);
    await expect(rows.first()).toContainText(/row limit/i);
  },
);

testWithAssets(
  'history placement and chart width',
  async ({ page, testAssets }) => {
    testWithAssets.setTimeout(TIMEOUT.SLOW_TEST * 2);
    await page.setViewportSize({ width: 1920, height: 1000 });
    await skipUnlessFeatureEnabled(page, 'VERSION_HISTORY');
    await authorizeApi(page);
    const chartId = await createHistoryChart(page, testAssets);
    await page.goto(`explore/?slice_id=${chartId}`);
    await expect(page.getByTestId('actions-trigger')).toBeVisible();

    // 1200/1201 straddle the removed overlay breakpoint; 1440/1480 straddle
    // the nominal 1452px combined minimum of the rails, chart, and history.
    const widths = [800, 1024, 1200, 1201, 1280, 1327, 1440, 1480, 1600, 1920];
    type Layout = Awaited<ReturnType<typeof measureHistoryLayout>>;
    const baselines = new Map<number, Layout>();
    const checkOpen = (
      open: Layout,
      closed: Layout,
      scenario = 'default rails',
    ) => {
      const label = `${open.width}px (${scenario})`;
      expect.soft(open.appScroll, `${label}: app scroll`).toBe(0);
      expect
        .soft(open.appScrollWidth, `${label}: horizontal overflow`)
        .toBeLessThanOrEqual((closed.appScrollWidth ?? NaN) + 1);
      expect
        .soft(
          Math.abs((open.chart?.width ?? NaN) - (closed.chart?.width ?? NaN)),
          `${label}: chart width change`,
        )
        .toBeLessThanOrEqual(1);
      for (const name of ['panel', 'close'] as const) {
        const box = open[name];
        expect
          .soft(box?.left, `${label}: ${name} left edge`)
          .toBeGreaterThanOrEqual(Math.max(0, open.content?.left ?? NaN) - 1);
        expect
          .soft(box?.right, `${label}: ${name} right edge`)
          .toBeLessThanOrEqual(
            Math.min(open.width, open.content?.right ?? NaN) + 1,
          );
        expect
          .soft(box?.top, `${label}: ${name} top edge`)
          .toBeGreaterThanOrEqual(Math.max(0, open.content?.top ?? NaN) - 1);
        expect
          .soft(box?.bottom, `${label}: ${name} bottom edge`)
          .toBeLessThanOrEqual(
            Math.min(open.height, open.content?.bottom ?? NaN) + 1,
          );
      }
      expect
        .soft(
          Math.abs((open.panel?.right ?? NaN) - (open.content?.right ?? NaN)),
          `${label}: panel right edge matches content`,
        )
        .toBeLessThanOrEqual(1);
      expect
        .soft(open.panel?.top, `${label}: panel below header`)
        .toBeGreaterThanOrEqual((open.headerActions?.bottom ?? NaN) - 1);
    };

    for (const width of widths) {
      await resizeExplore(page, width);
      const closed = await measureHistoryLayout(page);
      expect.soft(closed.appScroll, `${width}px: closed app scroll`).toBe(0);
      baselines.set(width, closed);
    }
    await openVersionHistory(page);
    await historicalGroup(page);
    // History is already open before narrowing to 800px: the cramped Explore
    // header is outside this panel-placement regression.
    for (const width of widths) {
      await resizeExplore(page, width);
      const closed = baselines.get(width);
      if (!closed) throw new Error(`Missing closed layout at ${width}`);
      checkOpen(await measureHistoryLayout(page), closed);
    }

    // Keep negative controls diagnostic: report the sampled widths rather than
    // attempting interactions after a containment failure.
    if (testWithAssets.info().errors.length === 0) {
      await clickWithoutScroll(page, page.getByTestId('actions-trigger'));
      await expect(
        page.getByRole('menuitem', { name: 'View version history' }),
      ).toBeVisible();
      await page.keyboard.press('Escape');
      await expectNoAppScroll(page);
      await resizeExplore(page, 1440);
      await clickWithoutScroll(
        page,
        page.getByRole('button', { name: 'Collapse Datasource panel' }),
      );
      const collapsed = await measureHistoryLayout(page);
      await clickWithoutScroll(
        page,
        page.getByRole('button', { name: 'Close version history' }),
      );
      await expect(
        page.getByRole('complementary', { name: 'Version history' }),
      ).toHaveCount(0);
      checkOpen(
        collapsed,
        await measureHistoryLayout(page),
        'collapsed datasource',
      );
      await openVersionHistory(page);
      await clickWithoutScroll(
        page,
        page.getByRole('button', { name: 'Open Datasource tab' }),
      );
      const reopened = await measureHistoryLayout(page);
      await clickWithoutScroll(
        page,
        page.getByRole('button', { name: 'Close version history' }),
      );
      await expect(
        page.getByRole('complementary', { name: 'Version history' }),
      ).toHaveCount(0);
      checkOpen(
        reopened,
        await measureHistoryLayout(page),
        'reopened datasource',
      );
    }

    await page.evaluate(() => {
      localStorage.setItem('datasource_width', JSON.stringify(450));
      localStorage.setItem('controls_width', JSON.stringify(450));
    });
    for (const width of [1440, 1920]) {
      await resizeExplore(page, width);
      await page.reload();
      await expect(page.getByTestId('actions-trigger')).toBeVisible();
      const closed = await measureHistoryLayout(page);
      for (const rail of ['datasourceRail', 'controlsRail'] as const) {
        expect
          .soft(
            Math.abs((closed[rail]?.width ?? NaN) - 450),
            `${width}px: persisted ${rail} width is 450px`,
          )
          .toBeLessThanOrEqual(1);
      }
      await openVersionHistory(page);
      const open = await measureHistoryLayout(page);
      checkOpen(open, closed, '450px rails');
      // Do not try to click a close button that the geometry already found
      // clipped. Reloading the next case supplies a fresh closed baseline.
    }
  },
);

testWithAssets(
  'history row actions at laptop width',
  async ({ page, testAssets }) => {
    testWithAssets.setTimeout(TIMEOUT.SLOW_TEST * 2);
    await page.setViewportSize({ width: 1280, height: 1000 });
    await skipUnlessFeatureEnabled(page, 'VERSION_HISTORY');
    await authorizeApi(page);
    const chartId = await createHistoryChart(page, testAssets);
    await page.goto(`explore/?slice_id=${chartId}`);
    await openVersionHistory(page);
    const panel = page.getByRole('complementary', { name: 'Version history' });
    const group = await historicalGroup(page);
    await expectControlInViewport(panel);
    await expectControlInViewport(
      panel.getByTestId('version-history-controls'),
    );
    await clickWithoutScroll(
      page,
      group.getByRole('button', { name: 'More actions' }),
    );
    await expectControlInViewport(
      page.getByRole('menuitem', { name: 'Open as new chart' }),
    );
    await clickWithoutScroll(
      page,
      page.getByRole('menuitem', { name: 'Restore this version' }),
    );
    const dialog = page.getByRole('dialog', { name: 'Restore this version?' });
    await clickWithoutScroll(
      page,
      dialog.getByRole('button', { name: 'Cancel', exact: true }),
    );
    await expect(dialog).toBeHidden();
    await searchHistory(page, 'vh1');
    await expect(
      panel.getByTestId('version-history-save-group').first(),
    ).toBeVisible();
    await clickWithoutScroll(
      page,
      panel.getByRole('combobox', { name: 'Filter version history' }),
    );
    await clickWithoutScroll(
      page,
      page.getByRole('option', { name: 'This chart only', exact: true }),
    );
    await clickWithoutScroll(
      page,
      panel.getByRole('button', { name: 'Close version history' }),
    );
    await expect(panel).toHaveCount(0);
    await openVersionHistory(page);
  },
);

testWithAssets(
  'preview banner actions at laptop width',
  async ({ page, testAssets }) => {
    testWithAssets.setTimeout(TIMEOUT.SLOW_TEST * 2);
    await page.setViewportSize({ width: 1280, height: 1000 });
    await skipUnlessFeatureEnabled(page, 'VERSION_HISTORY');
    await authorizeApi(page);
    const chartId = await createHistoryChart(page, testAssets);
    await page.goto(`explore/?slice_id=${chartId}`);
    await openVersionHistory(page);
    const group = await historicalGroup(page);
    const panel = page.getByRole('complementary', { name: 'Version history' });
    const banner = page.getByTestId('version-preview-banner');
    const enterPreview = async () => {
      await clickWithoutScroll(
        page,
        group.getByRole('button', { name: 'Preview this version' }),
      );
      await expect(banner).toContainText('Previewing historical version');
      await expect(banner.getByRole('button')).toHaveCount(3);
      await expect(
        page.getByTestId('chart-version-preview').locator('.ant-alert-error'),
      ).toHaveCount(0);
      const geometry = await page.evaluate(() => {
        const history = document
          .querySelector('aside[aria-label="Version history"]')
          ?.getBoundingClientRect();
        const buttons = [
          ...document.querySelectorAll(
            '[data-test="version-preview-banner"] button',
          ),
        ].map(button => {
          const box = button.getBoundingClientRect();
          return {
            label: button.textContent,
            left: box.left,
            right: box.right,
            top: box.top,
            bottom: box.bottom,
          };
        });
        return {
          panelLeft: history?.left,
          width: window.innerWidth,
          height: window.innerHeight,
          scroll: document.querySelector('#app')?.scrollLeft,
          buttons,
        };
      });
      // Fail immediately on a covered button, before Playwright can scroll it
      // into view. This is also the preview-padding negative control.
      expect(geometry.scroll).toBe(0);
      expect(geometry.panelLeft).toBeDefined();
      expect(geometry.buttons).toHaveLength(3);
      for (const button of geometry.buttons) {
        expect(button.left, button.label ?? '').toBeGreaterThanOrEqual(0);
        expect(button.right, button.label ?? '').toBeLessThanOrEqual(
          Math.min(geometry.width, geometry.panelLeft ?? 0),
        );
        expect(button.top, button.label ?? '').toBeGreaterThanOrEqual(0);
        expect(button.bottom, button.label ?? '').toBeLessThanOrEqual(
          geometry.height,
        );
      }
    };
    await enterPreview();
    await clickWithoutScroll(
      page,
      banner.getByRole('button', { name: 'Restore this version' }),
    );
    await clickWithoutScroll(
      page,
      page
        .getByRole('dialog', { name: 'Restore this version?' })
        .getByRole('button', { name: 'Cancel', exact: true }),
    );

    const originalUrl = new URL(page.url());
    // Both listeners precede the click: the blank tab opens synchronously,
    // while creating the chart follows an asynchronous snapshot request.
    const popupPromise = page.waitForEvent('popup');
    const createdPromise = page
      .waitForResponse(
        response =>
          response.request().method() === 'POST' &&
          new URL(response.url()).pathname.endsWith('/api/v1/chart/') &&
          response.ok(),
      )
      .then(async response => {
        const { id } = (await response.json()) as { id: number };
        expect(id, 'cloned chart id').toBeGreaterThan(0);
        testAssets.trackChart(id);
        return id;
      });
    let popup: Page | undefined;
    try {
      await clickWithoutScroll(
        page,
        banner.getByRole('button', { name: 'Open as new chart' }),
      );
      popup = await popupPromise;
      const id = await createdPromise;
      await popup.waitForURL(
        url => url.searchParams.get('slice_id') === String(id),
      );
    } finally {
      await popup?.close();
    }
    // Explore may add a form_data_key asynchronously without leaving the chart.
    const currentUrl = new URL(page.url());
    expect(currentUrl.origin).toBe(originalUrl.origin);
    expect(currentUrl.pathname).toBe(originalUrl.pathname);
    expect(currentUrl.searchParams.get('slice_id')).toBe(String(chartId));
    await clickWithoutScroll(
      page,
      banner.getByRole('button', { name: 'Close preview' }),
    );
    await expect(banner).toHaveCount(0);
    await expect(panel).toBeVisible();
    await enterPreview();
    await searchHistory(page, 'vh1');
    await clickWithoutScroll(
      page,
      panel.getByRole('button', { name: 'Close version history' }),
    );
    await expect(panel).toHaveCount(0);
    await expect(page.getByTestId('chart-version-preview')).toHaveCount(0);
    await openVersionHistory(page);
    await expect(page.getByTestId('chart-version-preview')).toHaveCount(0);
  },
);
