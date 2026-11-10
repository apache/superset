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
 * Fixture and shared setup for the asset-approval (maker-checker) suite.
 *
 * Every spec here builds the assets it needs through the authenticated REST
 * API and removes them afterwards, for the reason the activity-log spec
 * gives for doing the same: renaming or governing a seeded example makes
 * the test order-dependent and unsafe beside its siblings, and -- here
 * especially -- a captured save leaves a change request on the asset that
 * no later test can clear, so the next run meets an asset that is already
 * locked by somebody else's draft. The hand-QA baseline (dashboards 6, 7,
 * 10, 43, charts 1, 2, 69, dataset 1) is never touched.
 *
 * The suite reads an example dataset but never writes to one.
 */
import { Browser, Page, expect, test as base } from '@playwright/test';
import { apiGet, apiPost, apiPut } from '../../helpers/api/requests';
import { TIMEOUT } from '../../utils/constants';
import { getDatasetByName } from '../../helpers/api/dataset';
import { buildSingleRowDashboardLayout } from '../../helpers/api/dashboard';
import {
  CAPTURED,
  ReviewAssetType,
  approveChange,
  bindEditors,
  openChange,
  removeGovernedAsset,
  requireOpenChange,
  submitForReview,
} from '../../helpers/api/changeRequest';
import { signInAs } from '../../helpers/reviewUsers';

/** The dataset every chart in this suite is built on. Read-only. */
export const DATASET_NAME = 'birth_names';

/** Accounts the SOW's maker-checker story needs. All share one password. */
export type ReviewUser = 'alex' | 'priya' | 'sam' | 'morgan';

/** Author and second editor, by the display names `editors` resolves. */
export const AUTHOR_NAME = 'Alex Rivera';
export const APPROVER_NAME = 'Priya Shah';

/** Every asset this suite makes is named so a stray one is obvious. */
export const PREFIX = 'pw-approval';

export function uniqueName(label: string): string {
  return `${PREFIX}-${label}-${Date.now()}-${Math.floor(Math.random() * 1e4)}`;
}

/**
 * A time-series chart on `birth_names` whose viz type is a parameter.
 *
 * Bar and line draw the same data very differently, which is what lets a
 * test assert the preview really swapped the chart rather than only its
 * label.
 */
export function timeseriesParams(
  datasetId: number,
  vizType: string,
): Record<string, unknown> {
  return {
    datasource: `${datasetId}__table`,
    viz_type: vizType,
    x_axis: 'ds',
    time_grain_sqla: 'P1Y',
    metrics: ['count'],
    groupby: [],
    adhoc_filters: [],
    row_limit: 100,
  };
}

export interface ReviewFixture {
  /** A signed-in page for one of the review accounts, created on demand. */
  as(user: ReviewUser): Promise<Page>;
  /** `birth_names`' id on this instance. */
  datasetId(): Promise<number>;
  /** Remove this asset when the test ends, through the review workflow. */
  track(assetType: ReviewAssetType, assetId: number): void;
}

/**
 * Lazily signs each account in, and tears every created asset down through
 * the workflow afterwards (see `removeGovernedAsset`).
 */
export const reviewTest = base.extend<{ review: ReviewFixture }>({
  review: async ({ browser }, use) => {
    const pages = new Map<ReviewUser, Page>();
    const tracked: { assetType: ReviewAssetType; assetId: number }[] = [];
    let cachedDatasetId: number | undefined;

    const as = async (user: ReviewUser): Promise<Page> => {
      const existing = pages.get(user);
      if (existing) return existing;
      const page = await signInAs(browser as Browser, user);
      pages.set(user, page);
      return page;
    };

    await use({
      as,
      datasetId: async () => {
        if (cachedDatasetId !== undefined) return cachedDatasetId;
        const author = await as('alex');
        const dataset = await getDatasetByName(author, DATASET_NAME);
        expect(
          dataset,
          `${DATASET_NAME} exists — run Superset with --load-examples`,
        ).toBeTruthy();
        cachedDatasetId = (dataset as { id: number }).id;
        return cachedDatasetId;
      },
      track: (assetType, assetId) => tracked.push({ assetType, assetId }),
    });

    // Charts before dashboards: a chart still on a dashboard cannot be
    // purged. Reverse order of creation otherwise.
    const order: ReviewAssetType[] = ['dashboard', 'chart', 'dataset'];
    const author = pages.get('alex') ?? (await as('alex'));
    const approver = pages.get('priya') ?? (await as('priya'));
    for (const assetType of order) {
      for (const asset of [...tracked].reverse()) {
        if (asset.assetType !== assetType) continue;
        try {
          await removeGovernedAsset(
            author,
            approver,
            asset.assetType,
            asset.assetId,
          );
        } catch (error) {
          console.warn(
            `[asset-approval] could not remove ${asset.assetType} ${asset.assetId}:`,
            error,
          );
        }
      }
    }
    await Promise.all([...pages.values()].map(page => page.context().close()));
  },
});

export { expect };

export interface GovernedChart {
  id: number;
  name: string;
}

/**
 * A chart governed by review with Alex and Priya as its two editors.
 *
 * Two human editors is the setup maker-checker needs: one to make the
 * change and one who is allowed to approve it.
 */
export async function createGovernedChart(
  review: ReviewFixture,
  options: { label: string; vizType?: string; editors?: string[] },
): Promise<GovernedChart> {
  const author = await review.as('alex');
  const datasetId = await review.datasetId();
  const vizType = options.vizType ?? 'echarts_timeseries_bar';
  const name = uniqueName(options.label);

  const res = await apiPost(author, 'api/v1/chart/', {
    slice_name: name,
    viz_type: vizType,
    datasource_id: datasetId,
    datasource_type: 'table',
    params: JSON.stringify(timeseriesParams(datasetId, vizType)),
  });
  expect(res.ok(), 'chart creation').toBeTruthy();
  const id: number = (await res.json()).id;
  review.track('chart', id);

  await bindEditors(
    author,
    'chart',
    id,
    options.editors ?? [AUTHOR_NAME, APPROVER_NAME],
  );
  return { id, name };
}

/**
 * A published dashboard governed by review, with Alex and Priya as editors.
 *
 * Published through the review workflow, not by asking for it in the POST.
 * This fixture used to post `published: true` on the reasoning that
 * "creation is not gated", and that is only half right: creation is free,
 * but a dashboard is *created as a draft whatever the request says* (SOW
 * 5.1), because what review protects is first showing it to viewers. So the
 * create answered 202 with the publish request it had filed, and `id` in
 * that body is the change request's, not the dashboard's -- the fixture read
 * it as a dashboard id and every later call 404d.
 *
 * Creating a draft and then publishing it properly is also the only way to
 * reach the state these tests need. A published asset that is governed and
 * has nothing open cannot be conjured: the publish has to be asked for and
 * approved. Priya is bound as an editor before the request is filed, or
 * there would be nobody who may approve it.
 */
export async function createGovernedDashboard(
  review: ReviewFixture,
  options: {
    label: string;
    positionJson?: string;
    editors?: string[];
    /**
     * Leave it a draft. For a fixture that still has to put charts on it:
     * creating a chart onto a dashboard viewers can reach is refused (A5),
     * so everything goes on while it is a draft and the publish comes last.
     */
    publish?: boolean;
  },
): Promise<{ id: number; title: string }> {
  const author = await review.as('alex');
  const title = uniqueName(options.label);
  const res = await apiPost(author, 'api/v1/dashboard/', {
    dashboard_title: title,
    published: false,
    ...(options.positionJson ? { position_json: options.positionJson } : {}),
  });
  expect(res.ok(), 'dashboard creation').toBeTruthy();
  const id: number = (await res.json()).id;
  review.track('dashboard', id);
  const editors = options.editors ?? [AUTHOR_NAME, APPROVER_NAME];
  await bindEditors(author, 'dashboard', id, editors);

  // Only ask for the publish where somebody can approve it. A fixture that
  // deliberately binds one editor is testing "nobody may approve", and
  // filing a request it cannot clear would leave the dashboard locked for
  // the rest of the test.
  if (options.publish !== false && editors.includes(APPROVER_NAME)) {
    await publishThroughReview(review, id);
  }
  return { id, title };
}

/**
 * Ask to publish a draft dashboard and have the approver let it through.
 *
 * Leaves the dashboard published with no open request, which is the state a
 * test that wants to capture its *own* change has to start from -- an asset
 * holds one open request at a time, so a leftover one from the fixture would
 * make the test's write fold into it instead of opening its own.
 */
export async function publishThroughReview(
  review: ReviewFixture,
  id: number,
): Promise<void> {
  const author = await review.as('alex');
  const asked = await apiPut(
    author,
    `api/v1/dashboard/${id}`,
    { published: true },
    { failOnStatusCode: false },
  );
  expect(
    asked.status(),
    'publishing a draft is the reviewed transition, so it is captured',
  ).toBe(CAPTURED);

  const request = await requireOpenChange(author, 'dashboard', id);
  const submitted = await submitForReview(author, request.id, 'fixture publish');
  expect(submitted.ok(), 'submitting the publish request').toBeTruthy();

  const approver = await review.as('priya');
  const approved = await approveChange(approver, 'dashboard', id);
  expect(approved.ok(), 'approving the publish request').toBeTruthy();

  const readBack = await apiGet(author, `api/v1/dashboard/${id}`);
  expect(
    (await readBack.json()).result.published,
    'the dashboard the fixture hands back is actually published',
  ).toBe(true);
  expect(
    await openChange(author, 'dashboard', id),
    'the fixture leaves no open request for the test to collide with',
  ).toBeNull();
}

/** Capture a dashboard change through the API, and assert it was captured. */
export async function captureDashboardChange(
  authorPage: Page,
  dashboardId: number,
  payload: Record<string, unknown>,
): Promise<void> {
  const res = await apiPut(
    authorPage,
    `api/v1/dashboard/${dashboardId}`,
    payload,
    { failOnStatusCode: false },
  );
  expect(
    res.status(),
    'the save is held for review rather than applied',
  ).toBe(CAPTURED);
}

/**
 * A governed dashboard carrying `chartCount` governed charts.
 *
 * Built entirely while the dashboard is a draft, and published once at the
 * end. A draft is nobody's to see, so everything here applies directly: the
 * charts can name the dashboard in `dashboards` (creating a chart onto a
 * dashboard viewers *can* reach is refused outright -- A5), and the layout
 * write is exempt rather than captured (SOW 5.1).
 *
 * The publish is the one reviewed step, and it comes last for the same
 * reason: asking for it first would make every later step either refused or
 * captured, and the fixture would be assembling the dashboard through the
 * review queue instead of handing the test a finished one.
 */
export async function createGovernedDashboardWithCharts(
  review: ReviewFixture,
  options: { label: string; chartCount: number; vizType?: string },
): Promise<{
  dashboardId: number;
  title: string;
  charts: { id: number; name: string }[];
}> {
  const author = await review.as('alex');
  const datasetId = await review.datasetId();
  const vizType = options.vizType ?? 'big_number_total';

  const { id: dashboardId, title } = await createGovernedDashboard(review, {
    label: options.label,
    publish: false,
  });

  const charts: { id: number; name: string }[] = [];
  for (let index = 0; index < options.chartCount; index += 1) {
    const name = uniqueName(`${options.label}-card${index}`);
    const res = await apiPost(author, 'api/v1/chart/', {
      slice_name: name,
      viz_type: vizType,
      datasource_id: datasetId,
      datasource_type: 'table',
      params: JSON.stringify({
        datasource: `${datasetId}__table`,
        viz_type: vizType,
        metric: 'count',
        adhoc_filters: [],
      }),
      dashboards: [dashboardId],
    });
    expect(res.ok(), 'dashboard chart creation').toBeTruthy();
    const id: number = (await res.json()).id;
    review.track('chart', id);
    await bindEditors(author, 'chart', id, [AUTHOR_NAME, APPROVER_NAME]);
    charts.push({ id, name });
  }

  const layout = buildSingleRowDashboardLayout(
    charts.map(chart => ({ id: chart.id, sliceName: chart.name })),
  );
  const laidOut = await apiPut(
    author,
    `api/v1/dashboard/${dashboardId}`,
    { position_json: JSON.stringify(layout) },
    { failOnStatusCode: false },
  );
  expect(
    laidOut.status(),
    'laying out a draft is exempt from review, so it applies directly',
  ).toBe(200);

  await publishThroughReview(review, dashboardId);

  return { dashboardId, title, charts };
}

/** Capture a chart change through the API, and assert it was captured. */
export async function captureChartChange(
  authorPage: Page,
  chartId: number,
  payload: Record<string, unknown>,
): Promise<void> {
  const res = await apiPut(authorPage, `api/v1/chart/${chartId}`, payload, {
    failOnStatusCode: false,
  });
  expect(
    res.status(),
    'the save is held for review rather than applied',
  ).toBe(CAPTURED);
}

/**
 * How much of the rendered chart is drawn on, measured off the canvas.
 *
 * The chart plugins render to a canvas, so there is no element to assert a
 * viz type against -- and the label on the page is exactly what these
 * tests must not take the preview's word for. Instead the canvas is
 * redrawn into a fixed 64x64 frame and two things are read out of it: the
 * share of pixels that are not background (`inkFraction`), which separates
 * a bar chart's filled columns from a line chart's thin polyline by two
 * orders of magnitude, and a coarse luminance signature, which says
 * whether two renders are the *same* drawing.
 *
 * Returns null when nothing is rendered yet, so a caller can poll.
 */
export async function chartInk(
  page: Page,
  selector: string,
): Promise<{ inkFraction: number; signature: string } | null> {
  return page.evaluate(sel => {
    const canvas = document.querySelector(
      `${sel} canvas`,
    ) as HTMLCanvasElement | null;
    if (!canvas || !canvas.width || !canvas.height) return null;
    const size = 64;
    const frame = document.createElement('canvas');
    frame.width = size;
    frame.height = size;
    const context = frame.getContext('2d');
    if (!context) return null;
    // Flatten onto white first: a transparent chart background would
    // otherwise read as ink.
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, size, size);
    context.drawImage(canvas, 0, 0, size, size);
    const { data } = context.getImageData(0, 0, size, size);
    let inked = 0;
    const buckets: number[] = [];
    for (let i = 0; i < data.length; i += 4) {
      const luminance = (data[i] + data[i + 1] + data[i + 2]) / 3;
      if (luminance < 235) inked += 1;
      buckets.push(Math.round(luminance / 16));
    }
    return {
      inkFraction: inked / (size * size),
      signature: buckets.join(''),
    };
  }, selector);
}

/** Poll `chartInk` until the canvas has settled with something drawn on it. */
export async function settledChartInk(
  page: Page,
  selector: string,
): Promise<{ inkFraction: number; signature: string }> {
  let previous: { inkFraction: number; signature: string } | null = null;
  let settled: { inkFraction: number; signature: string } | null = null;
  await expect
    .poll(
      async () => {
        const current = await chartInk(page, selector);
        const stable =
          !!current &&
          current.inkFraction > 0 &&
          !!previous &&
          previous.signature === current.signature;
        previous = current;
        if (stable) settled = current;
        return stable;
      },
      {
        message: `${selector} renders a settled canvas`,
        timeout: 45000,
        intervals: [500, 750, 1000, 1000, 1000],
      },
    )
    .toBe(true);
  return settled as unknown as { inkFraction: number; signature: string };
}

/**
 * The review banner: the one alert on the page that talks about review.
 *
 * The banner carries no test id of its own -- it is a plain `Alert`, so
 * `role="alert"` is all there is -- and Superset's toasts are alerts too.
 * Matching on the banner's own vocabulary keeps the two apart without
 * asserting on markup, and is also the right granularity for the cases
 * that assert the banner is *absent*: a toast appearing must not make
 * those pass or fail.
 */
export const REVIEW_BANNER_TEXT =
  /seeing the live version|seeing the proposal|Viewing your changes|Awaiting review|requested changes|changes awaiting review|changes in progress|updating this after a review/;

/**
 * Navigate, waiting for the document rather than for `load`.
 *
 * This instance serves a development bundle whose HMR socket can keep the
 * `load` event from ever firing, and `page.goto` has no timeout of its
 * own -- so the default wait hangs until the whole test times out, with no
 * indication of which step did it. `AuthPage.goto` already navigates this
 * way, for the same reason.
 */
export async function goTo(page: Page, path: string): Promise<void> {
  await page.goto(path, {
    waitUntil: 'domcontentloaded',
    timeout: TIMEOUT.API_RESPONSE,
  });
}

export function reviewBanner(page: Page) {
  return page.getByRole('alert').filter({ hasText: REVIEW_BANNER_TEXT });
}

/** The switch that puts the proposal on screen in place of the live asset. */
export function showChangesSwitch(page: Page) {
  return page.locator('[data-test="show-changes-switch"]');
}

/** The strip that says which version of a chart is being drawn. */
export function versionNotice(page: Page) {
  return page.locator('[data-test="chart-version-notice"]');
}

/**
 * A modal's visible dialog.
 *
 * `data-test` on a Superset `Modal` lands on antd's `ant-modal-root`,
 * which has no box of its own and so reads as hidden even while the modal
 * is open. The dialog inside it is the thing a person can see.
 */
export function modalDialog(page: Page, testId: string) {
  return page.locator(`[data-test="${testId}"] [role="dialog"]`);
}

/**
 * Mark the document so a later check can tell a live update from a reload.
 *
 * Several of these rows are regressions where the right thing did appear,
 * but only after the author reloaded by hand. A value parked on `window`
 * is the cheapest honest witness: it cannot survive a navigation.
 */
export async function markDocument(page: Page, token = 'pw-no-reload') {
  await page.evaluate(value => {
    (window as unknown as Record<string, string>).__pwDocumentToken = value;
  }, token);
}

export async function documentNeverReloaded(page: Page, token = 'pw-no-reload') {
  const seen = await page.evaluate(
    () => (window as unknown as Record<string, string>).__pwDocumentToken,
  );
  expect(seen, 'the page updated in place rather than reloading').toBe(token);
}
