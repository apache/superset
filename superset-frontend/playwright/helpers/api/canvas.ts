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

import { Page, expect } from '@playwright/test';
import { isFeatureEnabled, skipUnlessFeatureEnabled } from '../featureFlags';
import { getDatasetByName } from './dataset';
import { apiDelete, apiGet, apiPatch, apiPost } from './requests';

/**
 * REST seeding for Canvas specs.
 *
 * Every URL is relative (no leading slash) so it resolves against
 * `PLAYWRIGHT_BASE_URL`, app prefix included. Content is applied the way the
 * product applies it: through a private draft, which is then either
 * committed (a published fixture) or left open (a draft fixture whose change
 * marks render).
 */
export const CANVAS_ENDPOINTS = {
  CANVAS: 'api/v1/canvas/',
  DRAFT: 'api/v1/canvas/draft',
  DRAFT_COMMIT: 'api/v1/canvas/draft/commit',
  WIDGET: 'api/v1/widget/',
} as const;

/** The header naming a draft; the token never goes in a URL the server sees. */
const DRAFT_HEADER = 'X-Canvas-Draft';

/** Statuses that mean a cleanup target is gone, whoever removed it. */
const CLEANUP_OK = new Set([200, 204, 404]);

/** The deterministic examples table every Playwright run loads. */
export const CANVAS_SEED_DATASET = 'birth_names';

/** One operation on a canvas definition, as `PATCH draft` takes it. */
export type CanvasOperation = Record<string, unknown> & { op: string };

interface DraftState {
  token: string;
  revision: number;
}

/**
 * Whether this run must have Canvas enabled. The dedicated CI step sets it, so
 * a backend that came up without the flag fails instead of skipping.
 */
export const canvasRequired = (): boolean =>
  process.env.PLAYWRIGHT_REQUIRE_CANVAS?.toLowerCase() === 'true';

/**
 * Skip when Canvas is off, or fail when the run requires it.
 *
 * Probes an ordinary page rather than a Canvas route: a disabled Canvas API
 * answers 404, which would read as a seed failure rather than a disabled
 * feature. Must run before any seeding or Canvas navigation.
 */
export async function requireOrSkipCanvas(page: Page): Promise<void> {
  if (!canvasRequired()) {
    await skipUnlessFeatureEnabled(page, 'CANVAS');
    return;
  }
  await page.goto('chart/list/');
  expect(
    await isFeatureEnabled(page, 'CANVAS'),
    'PLAYWRIGHT_REQUIRE_CANVAS is set, but CANVAS is disabled on the backend',
  ).toBe(true);
}

/** The published view of a canvas, or a draft of it when given a token. */
export function canvasPath(canvasId: number, draftToken?: string): string {
  const path = `canvas/${canvasId}/`;
  return draftToken ? `${path}#draft=${encodeURIComponent(draftToken)}` : path;
}

/** The widget entities a canvas' published definition places, by UUID. */
export async function canvasWidgetUuids(
  page: Page,
  canvasId: number,
): Promise<string[]> {
  const response = await apiGet(
    page,
    `${CANVAS_ENDPOINTS.CANVAS}${canvasId}/definition`,
    { failOnStatusCode: false },
  );
  if (response.status() === 404) return [];
  if (!response.ok()) {
    throw new Error(`definition read failed: HTTP ${response.status()}`);
  }
  const body: { result: { widgets?: Record<string, unknown> } } =
    await response.json();
  return Object.keys(body.result.widgets ?? {});
}

/** Delete `url`, treating "already gone" as done and reporting the rest. */
async function deleteQuietly(
  page: Page,
  url: string,
  what: string,
  headers?: Record<string, string>,
): Promise<void> {
  try {
    const response = await apiDelete(page, url, {
      headers,
      failOnStatusCode: false,
    });
    if (!CLEANUP_OK.has(response.status())) {
      // eslint-disable-next-line no-console
      console.warn(`[canvas cleanup] ${what}: HTTP ${response.status()}`);
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn(`[canvas cleanup] ${what}:`, error);
  }
}

/**
 * The canvases, drafts and widget entities a spec created, removed even when
 * the spec fails part-way through seeding.
 */
export class CanvasSeedTracker {
  private readonly canvasIds = new Set<number>();

  private readonly draftTokens = new Set<string>();

  constructor(private readonly page: Page) {}

  trackCanvas(id: number): void {
    this.canvasIds.add(id);
  }

  trackDraft(token: string): void {
    this.draftTokens.add(token);
  }

  /** A committed draft is gone server-side; nothing to discard later. */
  untrackDraft(token: string): void {
    this.draftTokens.delete(token);
  }

  /**
   * Drafts first (they hold their canvas open), then canvases, then the
   * widget entities they placed: deleting a canvas leaves its widgets behind.
   * Failures are reported rather than thrown, so cleanup never masks the
   * spec's own result.
   */
  async cleanup(): Promise<void> {
    const { page } = this;
    await Promise.all(
      [...this.draftTokens].map(token =>
        deleteQuietly(page, CANVAS_ENDPOINTS.DRAFT, 'draft', {
          [DRAFT_HEADER]: token,
        }),
      ),
    );
    this.draftTokens.clear();

    const widgetUuids = await Promise.all(
      [...this.canvasIds].map(id =>
        canvasWidgetUuids(page, id).catch(error => {
          // eslint-disable-next-line no-console
          console.warn(`[canvas cleanup] widgets of canvas ${id}:`, error);
          return [] as string[];
        }),
      ),
    );
    await Promise.all(
      [...this.canvasIds].map(id =>
        deleteQuietly(page, `${CANVAS_ENDPOINTS.CANVAS}${id}`, `canvas ${id}`),
      ),
    );
    this.canvasIds.clear();

    await Promise.all(
      widgetUuids
        .flat()
        .map(uuid =>
          deleteQuietly(
            page,
            `${CANVAS_ENDPOINTS.WIDGET}${uuid}`,
            `widget ${uuid}`,
          ),
        ),
    );
  }
}

/** Create an empty canvas owned by the session user. */
export async function createCanvas(
  page: Page,
  tracker: CanvasSeedTracker,
  title: string,
): Promise<number> {
  const response = await apiPost(page, CANVAS_ENDPOINTS.CANVAS, { title });
  const body: { id: number } = await response.json();
  tracker.trackCanvas(body.id);
  return body.id;
}

/** Start a private draft of a canvas. */
export async function startDraft(
  page: Page,
  tracker: CanvasSeedTracker,
  canvasId: number,
): Promise<DraftState> {
  const response = await apiPost(
    page,
    `${CANVAS_ENDPOINTS.CANVAS}${canvasId}/draft`,
  );
  const body: { result: DraftState } = await response.json();
  tracker.trackDraft(body.result.token);
  return { token: body.result.token, revision: body.result.revision };
}

/** Apply operations to a draft; returns the draft at its new revision. */
export async function applyDraftOperations(
  page: Page,
  draft: DraftState,
  ops: CanvasOperation[],
): Promise<DraftState> {
  const response = await apiPatch(
    page,
    CANVAS_ENDPOINTS.DRAFT,
    { revision: draft.revision, ops },
    { headers: { [DRAFT_HEADER]: draft.token } },
  );
  const body: { result: { revision: number } } = await response.json();
  return { token: draft.token, revision: body.result.revision };
}

/** Publish a draft. The draft is deleted by the commit. */
export async function commitDraft(
  page: Page,
  tracker: CanvasSeedTracker,
  draft: DraftState,
): Promise<void> {
  await apiPost(
    page,
    CANVAS_ENDPOINTS.DRAFT_COMMIT,
    { revision: draft.revision },
    { headers: { [DRAFT_HEADER]: draft.token } },
  );
  tracker.untrackDraft(draft.token);
}

/** A unique suffix, so parallel workers and retries never share a title. */
export const uniqueSuffix = (): string =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

/** The `births` metric every seeded data widget reads. */
const BIRTHS = {
  expressionType: 'SQL',
  sqlExpression: 'SUM(num)',
  label: 'births',
};

/** A bar of births per gender: two rows, whatever the examples' load date. */
const barChartProps = (datasetId: number) => ({
  dataBinding: {
    datasetId,
    metrics: [BIRTHS],
    dimensions: ['gender'],
    orderBy: [{ field: 'gender' }],
    rowLimit: 10,
  },
  echartsOptions: {
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'category',
      data: { $bind: { source: 'dimension', alias: 'gender' } },
    },
    yAxis: { type: 'value' },
    series: [
      { type: 'bar', data: { $bind: { source: 'metric', alias: 'births' } } },
    ],
  },
});

/** Placement ids the published fixture uses, for locating its widgets. */
export const PUBLISHED_NODES = {
  table: 'containment-table',
  following: 'containment-following-chart',
} as const;

/** The rows the seeded table holds; far more than its cell can show. */
export const PUBLISHED_TABLE_ROW_LIMIT = 200;

/**
 * A committed canvas: a many-row table with a chart directly below it.
 *
 * The table reads distinct names from `birth_names`, sorted by name, so its
 * rows and their order are fixed by the examples data.
 */
export async function seedPublishedCanvas(
  page: Page,
  tracker: CanvasSeedTracker,
): Promise<{ canvasId: number }> {
  const dataset = await getDatasetByName(page, CANVAS_SEED_DATASET);
  if (!dataset) {
    throw new Error(
      `The ${CANVAS_SEED_DATASET} examples dataset is missing or unreadable; Canvas seeding needs it`,
    );
  }
  const suffix = uniqueSuffix();
  const canvasId = await createCanvas(
    page,
    tracker,
    `Containment published ${suffix}`,
  );
  const draft = await startDraft(page, tracker, canvasId);
  const applied = await applyDraftOperations(page, draft, [
    {
      op: 'add',
      id: PUBLISHED_NODES.table,
      widgetType: 'ag-grid-table',
      name: `Names ${suffix}`,
      props: {
        dataBinding: {
          datasetId: dataset.id,
          metrics: [BIRTHS],
          dimensions: ['name'],
          orderBy: [{ field: 'name' }],
          rowLimit: PUBLISHED_TABLE_ROW_LIMIT,
        },
      },
      layout: { col: 1, row: 1, colSpan: 12, rowSpan: 6 },
    },
    {
      op: 'add',
      id: PUBLISHED_NODES.following,
      widgetType: 'echarts',
      name: `Births by gender ${suffix}`,
      props: barChartProps(dataset.id),
      layout: { col: 1, row: 7, colSpan: 12, rowSpan: 6 },
    },
  ]);
  await commitDraft(page, tracker, applied);
  return { canvasId };
}

/** Placement ids the draft fixture uses. */
export const DRAFT_NODES = {
  group: 'marked-group',
  first: 'marked-group-first',
  last: 'marked-group-last',
} as const;

/**
 * An empty canvas with an open, uncommitted draft that adds a titled group
 * of two stacked markdown widgets. Everything in the draft is new, so the
 * group carries a change mark in the draft view.
 */
export async function seedDraftGroupCanvas(
  page: Page,
  tracker: CanvasSeedTracker,
): Promise<{ canvasId: number; draftToken: string }> {
  const suffix = uniqueSuffix();
  const canvasId = await createCanvas(
    page,
    tracker,
    `Containment draft ${suffix}`,
  );
  const draft = await startDraft(page, tracker, canvasId);
  const markdown = (content: string, row: number) => ({
    op: 'add',
    widgetType: 'markdown',
    props: { content },
    parent: DRAFT_NODES.group,
    layout: { col: 1, row, colSpan: 12, rowSpan: 3 },
  });
  await applyDraftOperations(page, draft, [
    {
      op: 'add',
      id: DRAFT_NODES.group,
      widgetType: 'group',
      props: {
        title:
          'A marked group whose title is long enough to run into its controls',
      },
      layout: { col: 1, row: 1, colSpan: 12, rowSpan: 7 },
    },
    { ...markdown('First row of the group', 1), id: DRAFT_NODES.first },
    { ...markdown('Last row of the group', 4), id: DRAFT_NODES.last },
  ]);
  return { canvasId, draftToken: draft.token };
}
