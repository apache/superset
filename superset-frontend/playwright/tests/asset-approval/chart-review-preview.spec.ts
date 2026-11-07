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
 * The chart review preview in Explore: the Show changes switch, the notice
 * strip, the frozen control columns, the docked review panel, and what
 * approving leaves behind.
 *
 * Requires CHANGE_MANAGEMENT on and the `preset.asset-approval` extension
 * installed, plus two editors on each asset -- the author may never
 * approve their own change, so a reviewer here is always a second
 * signed-in account (see `helpers/reviewUsers.ts`).
 *
 * Every chart is created and removed by the test; see
 * `asset-approval-helpers.ts` for why none of the seeded examples is used.
 *
 * Covers rows 1-7 of the browser-only QA set.
 */
import { Page } from '@playwright/test';
import { apiGet } from '../../helpers/api/requests';
import { openChange, requireOpenChange, submitForReview } from '../../helpers/api/changeRequest';
import { ExplorePage } from '../../pages/ExplorePage';
import { TIMEOUT } from '../../utils/constants';
import {
  captureChartChange,
  createGovernedChart,
  documentNeverReloaded,
  expect,
  markDocument,
  modalDialog,
  reviewBanner,
  reviewTest,
  settledChartInk,
  showChangesSwitch,
  versionNotice,
  type ReviewFixture,
} from './asset-approval-helpers';

const BAR = 'echarts_timeseries_bar';
const LINE = 'echarts_timeseries_line';

const LIVE_CHART = '[data-test="chart-container"]';
const PROPOSED_CHART = '[data-test="proposed-chart-preview"]';

/** A chart whose bar-to-line change is already waiting for Priya. */
async function chartPendingReview(
  review: ReviewFixture,
  label: string,
): Promise<{ chartId: number; name: string; author: Page; reviewer: Page }> {
  const author = await review.as('alex');
  const datasetId = await review.datasetId();
  const chart = await createGovernedChart(review, { label, vizType: BAR });

  await captureChartChange(author, chart.id, {
    viz_type: LINE,
    params: JSON.stringify({
      datasource: `${datasetId}__table`,
      viz_type: LINE,
      x_axis: 'ds',
      time_grain_sqla: 'P1Y',
      metrics: ['count'],
      groupby: [],
      adhoc_filters: [],
      row_limit: 100,
    }),
  });
  const change = await requireOpenChange(author, 'chart', chart.id);
  expect((await submitForReview(author, change.id)).ok()).toBeTruthy();

  const reviewer = await review.as('priya');
  return { chartId: chart.id, name: chart.name, author, reviewer };
}

/** Open the chart and wait for Explore to have drawn something. */
async function openExplore(page: Page, chartId: number): Promise<void> {
  const explore = new ExplorePage(page);
  await explore.goto(chartId, { timeout: TIMEOUT.EXPLORE_PAGE_LOAD });
  await expect(page.locator(`${LIVE_CHART} canvas`)).toBeVisible({
    timeout: TIMEOUT.CHART_RENDER,
  });
}

/**
 * Row 1 — a captured save puts the next action on screen immediately.
 *
 * The defect this covers (129074): everything the author needed existed,
 * but only after a manual reload, because the page's review state was
 * fetched before the change it describes existed.
 */
reviewTest(
  'row 1: saving a chart change from Explore is captured and the review controls appear without a reload',
  async ({ review }) => {
    reviewTest.setTimeout(3 * TIMEOUT.SLOW_TEST);
    const author = await review.as('alex');
    const chart = await createGovernedChart(review, {
      label: 'row1',
      vizType: BAR,
    });

    await openExplore(author, chart.id);
    // Nothing on the page claims a change yet.
    await expect(reviewBanner(author)).toHaveCount(0);

    // Change the drawing, so the save carries a real proposal.
    await author
      .locator('[data-test="fast-viz-switcher"] [role="button"]')
      .filter({ hasText: 'Line Chart' })
      .click();
    await expect(author.locator(`${LIVE_CHART} canvas`)).toBeVisible({
      timeout: TIMEOUT.CHART_RENDER,
    });

    await markDocument(author);
    const explore = new ExplorePage(author);
    const saveModal = await explore.openSaveModal();
    await saveModal.selectSaveAction('overwrite');
    const save = author.waitForResponse(
      response =>
        response.request().method() === 'PUT' &&
        response.url().includes(`/api/v1/chart/${chart.id}`),
    );
    await saveModal.clickSave();

    const saveResponse = await save;
    expect(
      saveResponse.status(),
      'the save is held for review rather than published',
    ).toBe(202);
    expect((await saveResponse.json()).review_required).toBe(true);

    // The banner and the three affordances the author needs next.
    await expect(reviewBanner(author)).toBeVisible({
      timeout: TIMEOUT.UI_TRANSITION,
    });
    await expect(reviewBanner(author)).toContainText(
      'you and viewers are both seeing the live version',
    );
    await expect(showChangesSwitch(author)).toBeVisible();
    await expect(
      reviewBanner(author).getByRole('button', { name: 'What changed' }),
    ).toBeVisible();
    await expect(
      reviewBanner(author).getByRole('button', { name: 'Request review' }),
    ).toBeVisible();

    // The chart is still on screen -- the save neither navigated nor
    // emptied the page -- and the strip says it is the live version.
    await expect(author.locator(`${LIVE_CHART} canvas`)).toBeVisible();
    await expect(versionNotice(author)).toHaveText(
      'Live version · what viewers see now',
    );
    await documentNeverReloaded(author);
  },
);

/**
 * Row 2 — the strip labels both states, at one height.
 *
 * Only the proposal used to be labelled, which left the live chart as a
 * silent default a reviewer could approve without ever having looked. The
 * equal height is the other half: the label must not shove the chart under
 * the reader's eye as it flips.
 */
reviewTest(
  'row 2: the notice strip names the live and the proposed version at the same height',
  async ({ review }) => {
    reviewTest.setTimeout(3 * TIMEOUT.SLOW_TEST);
    // Driven as the REVIEWER, who is the reader with two states: Explore
    // seeds the author's own draft as its form data, so the author opens on
    // the proposal and stays on it, and asserting the live label for them
    // was pinning the defect rather than the design (see the author row
    // below). The reviewer's default really is the live chart.
    const { chartId, reviewer } = await chartPendingReview(review, 'row2');

    await openExplore(reviewer, chartId);
    await expect(versionNotice(reviewer)).toHaveText(
      'Live version · what viewers see now',
    );
    const live = await versionNotice(reviewer).boundingBox();
    expect(live, 'the strip has a box while the live chart is on screen').toBeTruthy();

    await showChangesSwitch(reviewer).click();
    await expect(reviewer.locator(`${PROPOSED_CHART} canvas`)).toBeVisible({
      timeout: TIMEOUT.CHART_RENDER,
    });
    await expect(versionNotice(reviewer)).toHaveText(
      'Proposed version · not live until approved',
    );
    const proposed = await versionNotice(reviewer).boundingBox();

    expect(
      proposed?.height,
      'the strip is the same height in both states, so flipping the switch does not move the chart',
    ).toBeCloseTo(live?.height as number, 1);
  },
);

/**
 * Row 3 — the reviewer's banner says which version they are looking at.
 *
 * The costly mistake is the quiet one: approving the live chart without
 * ever having turned the switch on. The banner is the one persistent
 * statement at the top of the page, so it has to differ between the two.
 */
reviewTest(
  'row 3: the reviewer banner distinguishes seeing the live version from seeing the proposal',
  async ({ review }) => {
    reviewTest.setTimeout(3 * TIMEOUT.SLOW_TEST);
    const { chartId, reviewer } = await chartPendingReview(review, 'row3');

    await openExplore(reviewer, chartId);
    const banner = reviewBanner(reviewer);
    await expect(banner).toBeVisible({ timeout: TIMEOUT.UI_TRANSITION });
    await expect(banner).toContainText('proposed');
    await expect(banner).toContainText('you are seeing the live version');

    await showChangesSwitch(reviewer).click();
    await expect(reviewer.locator(`${PROPOSED_CHART} canvas`)).toBeVisible({
      timeout: TIMEOUT.CHART_RENDER,
    });
    await expect(banner).toContainText('you are seeing the proposal');
    await expect(banner).not.toContainText('you are seeing the live version');
  },
);

/**
 * Row 4 — the switch swaps the drawing, not just the label.
 *
 * Asserted off the canvas rather than off any element or caption: the
 * plugins draw to a canvas, so there is no viz type in the DOM to lean on,
 * and the caption is precisely the thing under test. A bar chart's filled
 * columns cover a large share of the frame and a line chart's polyline
 * almost none, and turning the switch off must restore the live drawing
 * exactly -- which is what makes the difference in between meaningful
 * rather than noise.
 */
reviewTest(
  'row 4: with the switch on the rendered chart really is the proposed one',
  async ({ review }) => {
    reviewTest.setTimeout(4 * TIMEOUT.SLOW_TEST);
    const { chartId, reviewer } = await chartPendingReview(review, 'row4');

    await openExplore(reviewer, chartId);
    const liveBar = await settledChartInk(reviewer, LIVE_CHART);

    await showChangesSwitch(reviewer).click();
    await expect(reviewer.locator(`${PROPOSED_CHART} canvas`)).toBeVisible({
      timeout: TIMEOUT.CHART_RENDER,
    });
    const proposedLine = await settledChartInk(reviewer, PROPOSED_CHART);

    expect(
      proposedLine.signature,
      'the proposal is drawn differently from the live chart',
    ).not.toEqual(liveBar.signature);
    // A bar chart fills columns down to the axis; a line chart draws a
    // thin path. Measured on this fixture: ~0.55 against ~0.01.
    expect(
      proposedLine.inkFraction,
      'the proposal is drawn as a line chart (far less ink than bars)',
    ).toBeLessThan(liveBar.inkFraction / 3);

    await showChangesSwitch(reviewer).click();
    await expect(reviewer.locator(`${LIVE_CHART} canvas`)).toBeVisible({
      timeout: TIMEOUT.CHART_RENDER,
    });
    const liveAgain = await settledChartInk(reviewer, LIVE_CHART);
    expect(
      liveAgain.signature,
      'turning the switch off puts the live drawing back exactly',
    ).toEqual(liveBar.signature);
  },
);

/**
 * Row 5 — the columns beside a preview say what they are and do nothing.
 *
 * The control panels are the author's working copy, not a renderer. While
 * a proposal is on screen they would otherwise read as the settings that
 * produced it, and a reviewer poking one would be editing a chart whose
 * change they have not decided yet.
 */
reviewTest(
  'row 5: with the preview on, the datasource and control columns are captioned and inert',
  async ({ review }) => {
    reviewTest.setTimeout(3 * TIMEOUT.SLOW_TEST);
    const { chartId, reviewer } = await chartPendingReview(review, 'row5');

    await openExplore(reviewer, chartId);
    await expect(
      reviewer.getByText('Frozen while a preview is on screen'),
    ).toHaveCount(0);

    await showChangesSwitch(reviewer).click();
    await expect(reviewer.locator(`${PROPOSED_CHART} canvas`)).toBeVisible({
      timeout: TIMEOUT.CHART_RENDER,
    });

    await expect(
      reviewer
        .locator('.explore-column.data-source-selection')
        .getByText('Frozen while a preview is on screen'),
    ).toBeVisible();
    await expect(
      reviewer
        .locator('.explore-column.controls-column')
        .getByText('Live chart settings · not the version on screen'),
    ).toBeVisible();

    const datasourceGate = reviewer.locator(
      '[data-test="explore-datasource-gate"]',
    );
    const controlsGate = reviewer.locator('[data-test="explore-controls-gate"]');
    await expect(datasourceGate).toHaveAttribute('aria-disabled', 'true');
    await expect(controlsGate).toHaveAttribute('aria-disabled', 'true');

    // Inert for real: a control inside the gate cannot be reached by a
    // click, so the attempt times out instead of opening anything.
    const control = controlsGate.locator('[role="combobox"]').first();
    await expect(control).toHaveCount(1);
    await expect(
      control.click({ timeout: 3000 }),
      'a control behind the gate does not accept a click',
    ).rejects.toThrow();
    await expect(reviewer.locator('.ant-select-dropdown')).toHaveCount(0);
  },
);

/**
 * Row 6 — the panel sits beside the chart and stays usable.
 *
 * It used to float over the page, which put the decision on top of the
 * thing being decided. Asserted geometrically rather than by where the
 * element lives in the tree: the claim is that it does not cover the
 * chart.
 */
reviewTest(
  'row 6: the review panel docks beside the preview and keeps Approve and Request changes reachable',
  async ({ review }) => {
    reviewTest.setTimeout(3 * TIMEOUT.SLOW_TEST);
    const { chartId, reviewer } = await chartPendingReview(review, 'row6');

    await openExplore(reviewer, chartId);
    // The reviewer is shown what they are deciding on without going
    // looking for it, so the panel is already open.
    const panel = reviewer.locator('[data-test="what-changed-panel"]');
    await expect(panel).toBeVisible({ timeout: TIMEOUT.UI_TRANSITION });

    await showChangesSwitch(reviewer).click();
    await expect(reviewer.locator(`${PROPOSED_CHART} canvas`)).toBeVisible({
      timeout: TIMEOUT.CHART_RENDER,
    });

    const panelBox = await panel.boundingBox();
    const previewBox = await reviewer.locator(PROPOSED_CHART).boundingBox();
    expect(panelBox && previewBox).toBeTruthy();
    expect(
      (panelBox as { x: number }).x,
      'the panel starts where the chart ends rather than covering it',
    ).toBeGreaterThanOrEqual(
      (previewBox as { x: number; width: number }).x +
        (previewBox as { width: number }).width -
        1,
    );

    const approve = panel.locator('[data-test="panel-approve"]');
    const requestChanges = panel.locator(
      '[data-test="panel-request-changes"]',
    );
    await expect(approve).toBeVisible();
    await expect(approve).toBeEnabled();
    await expect(requestChanges).toBeVisible();
    await expect(requestChanges).toBeEnabled();
  },
);

/**
 * Row 7 — approving publishes, and takes the review UI with it.
 *
 * The URL half of this row is about the navigation approval triggers: the
 * approved chart has to be fetched from its `slice_id`, not from the
 * `form_data_key` the reviewer's session was holding, which describes the
 * chart as it was before the decision. Explore mints a key again once it
 * has reloaded (the key is cached per session and tab, so it can even be
 * the same string), so the assertion is on the navigation, which is where
 * the staleness would do its damage -- not on the URL after the page has
 * settled, where a key is always expected.
 */
reviewTest(
  'row 7: approving publishes the change, removes the review UI and reloads off slice_id',
  async ({ review }) => {
    reviewTest.setTimeout(4 * TIMEOUT.SLOW_TEST);
    const { chartId, reviewer, author } = await chartPendingReview(
      review,
      'row7',
    );

    await openExplore(reviewer, chartId);
    const panel = reviewer.locator('[data-test="what-changed-panel"]');
    await expect(panel).toBeVisible({ timeout: TIMEOUT.UI_TRANSITION });
    await showChangesSwitch(reviewer).click();
    await expect(reviewer.locator(`${PROPOSED_CHART} canvas`)).toBeVisible({
      timeout: TIMEOUT.CHART_RENDER,
    });

    // Precondition for the second half: Explore has parked a form-data key
    // in the URL, so there is something stale for approval to escape.
    await expect
      .poll(() => new URL(reviewer.url()).searchParams.has('form_data_key'), {
        message: 'Explore puts a form_data_key in the URL',
        timeout: TIMEOUT.UI_TRANSITION,
      })
      .toBe(true);

    const navigations: string[] = [];
    reviewer.on('framenavigated', frame => {
      if (frame === reviewer.mainFrame()) navigations.push(frame.url());
    });

    await panel.locator('[data-test="panel-approve"]').click();
    const confirm = modalDialog(reviewer, 'approve-publish-modal');
    await expect(
      reviewer.getByRole('button', { name: 'Approve and publish' }),
    ).toBeVisible({ timeout: TIMEOUT.UI_TRANSITION });
    await reviewer
      .getByRole('button', { name: 'Approve and publish' })
      .click();
    await expect(confirm).toHaveCount(0, { timeout: TIMEOUT.UI_TRANSITION });

    // Published: the chart itself now holds the proposed viz type and has
    // no open change left.
    await expect
      .poll(
        async () => {
          const res = await apiGet(author, `api/v1/chart/${chartId}`);
          return (await res.json()).result.viz_type;
        },
        { message: 'the proposal is published', timeout: TIMEOUT.API_RESPONSE },
      )
      .toBe(LINE);
    expect(await openChange(author, 'chart', chartId)).toBeNull();

    // Every trace of review is gone from the reviewer's page.
    await expect(versionNotice(reviewer)).toHaveCount(0, {
      timeout: TIMEOUT.PAGE_LOAD,
    });
    await expect(showChangesSwitch(reviewer)).toHaveCount(0);
    await expect(panel).toHaveCount(0);
    await expect(reviewer.locator(PROPOSED_CHART)).toHaveCount(0);
    await expect(reviewBanner(reviewer)).toHaveCount(0);

    // The reload that published it went to the chart, not to the stale key.
    expect(
      navigations.some(
        url => !new URL(url).searchParams.has('form_data_key'),
      ),
      `approval reloaded without the stale form_data_key; saw ${navigations.join(', ')}`,
    ).toBe(true);
    expect(new URL(reviewer.url()).searchParams.get('slice_id')).toBe(
      String(chartId),
    );
  },
);
