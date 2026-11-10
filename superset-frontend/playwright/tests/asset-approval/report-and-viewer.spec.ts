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
 * The two audiences that must never see review chrome: a report renderer,
 * and a viewer.
 *
 * They fail in opposite ways. Report mode is a real editor's session --
 * the headless browser signs in as a person who may well have a draft --
 * so the page has to withhold the banner it would otherwise be right to
 * show. A viewer is the other way round: the API returns nothing for them,
 * so the page has nothing to leak, and this asserts the existence of a
 * pending change does not reach them by any other route either.
 *
 * Covers rows 13 (R5-02) and 14 (S-08).
 */
import { apiGet } from '../../helpers/api/requests';
import { openChange } from '../../helpers/api/changeRequest';
import { TIMEOUT } from '../../utils/constants';
import { URL } from '../../utils/urls';
import {
  captureChartChange,
  captureDashboardChange,
  createGovernedChart,
  createGovernedDashboardWithCharts,
  expect,
  goTo,
  reviewBanner,
  reviewTest,
  showChangesSwitch,
  versionNotice,
} from './asset-approval-helpers';

/**
 * Row 13 [R5-02] — report mode renders the chart and nothing else.
 *
 * `standalone=3` is the mode a scheduled report and a thumbnail are drawn
 * in. An editor with a draft had their review banner painted into the PNG
 * and emailed to the recipients.
 */
reviewTest(
  'row 13 [R5-02]: report mode on a chart with a change pending renders the chart alone',
  async ({ review }) => {
    reviewTest.setTimeout(3 * TIMEOUT.SLOW_TEST);
    const author = await review.as('alex');
    const chart = await createGovernedChart(review, { label: 'row13' });
    await captureChartChange(author, chart.id, {
      slice_name: `${chart.name}-proposed`,
    });

    // The change really is open, so an absent banner is a withheld one
    // rather than nothing to show.
    expect(await openChange(author, 'chart', chart.id)).not.toBeNull();

    // First confirm the ordinary page does show it, so the report-mode
    // assertion is not passing because the fixture is wrong.
    await goTo(author, `explore/?slice_id=${chart.id}`);
    await expect(reviewBanner(author)).toBeVisible({
      timeout: TIMEOUT.EXPLORE_PAGE_LOAD,
    });

    await goTo(author, `explore/?slice_id=${chart.id}&standalone=3`);
    await expect(
      author.locator('[data-test="chart-container"] canvas'),
      'the chart itself still renders',
    ).toBeVisible({ timeout: TIMEOUT.CHART_RENDER });

    await expect(reviewBanner(author)).toHaveCount(0);
    await expect(versionNotice(author)).toHaveCount(0);
    await expect(showChangesSwitch(author)).toHaveCount(0);
    await expect(
      author.locator('[data-test="what-changed-panel"]'),
    ).toHaveCount(0);
    await expect(
      author.locator('#change-review-panel-slot'),
      'the slot the panel would dock into is not laid out at all',
    ).toHaveCount(0);
  },
);

/**
 * Row 14 [S-08] — a viewer learns nothing.
 *
 * Sam can read this dashboard and edits nothing on this instance. SOW 5.5
 * and Visa Q6 put it plainly: a viewer must not be able to tell that a
 * change is waiting, so there is no banner, no way in to edit, and no tag
 * -- on the asset or in the list it is found from.
 */
reviewTest(
  'row 14 [S-08]: a viewer sees no banner, no Edit and no Changes pending tag on a governed asset',
  async ({ review }) => {
    reviewTest.setTimeout(4 * TIMEOUT.SLOW_TEST);
    const author = await review.as('alex');
    const { dashboardId, title, charts } =
      await createGovernedDashboardWithCharts(review, {
        label: 'row14',
        chartCount: 1,
      });
    await captureDashboardChange(author, dashboardId, {
      dashboard_title: `${title}-proposed`,
    });
    expect(await openChange(author, 'dashboard', dashboardId)).not.toBeNull();

    // The author sees it, so what the viewer does not see is being
    // withheld from them specifically.
    await goTo(author, `dashboard/${dashboardId}/`);
    await expect(reviewBanner(author)).toBeVisible({
      timeout: TIMEOUT.PAGE_LOAD,
    });

    const viewer = await review.as('sam');
    // Sam can read it -- otherwise every assertion below would pass
    // because there was no page.
    const readable = await apiGet(viewer, `api/v1/dashboard/${dashboardId}`, {
      failOnStatusCode: false,
    });
    expect(readable.status(), 'the viewer can open the dashboard').toBe(200);
    // ...and the review API tells them nothing.
    expect(await openChange(viewer, 'dashboard', dashboardId)).toBeNull();

    await goTo(viewer, `dashboard/${dashboardId}/`);
    await expect(
      viewer.locator('[data-test="dashboard-header-container"]'),
    ).toBeVisible({ timeout: TIMEOUT.PAGE_LOAD });
    // The dashboard is the live one, by its live title.
    await expect(viewer.locator('[data-test="editable-title-input"]')).toHaveValue(
      title,
    );

    await expect(reviewBanner(viewer)).toHaveCount(0);
    await expect(
      viewer.locator('[data-test="edit-dashboard-button"]'),
      'a viewer is not offered a way into edit mode',
    ).toHaveCount(0);
    await expect(
      viewer.locator('[data-test="review-status-tag"]'),
    ).toHaveCount(0);
    await expect(showChangesSwitch(viewer)).toHaveCount(0);

    // Nor in the list the dashboard is found from.
    await goTo(viewer, URL.DASHBOARD_LIST);
    const row = viewer.locator('tbody tr').filter({ hasText: title });
    await expect(row).toHaveCount(1, { timeout: TIMEOUT.PAGE_LOAD });
    await expect(row.locator('[data-test="review-status-tag"]')).toHaveCount(0);
    await expect(row).not.toContainText(`${title}-proposed`);

    // And the chart the dashboard carries is equally silent.
    await goTo(viewer, `explore/?slice_id=${charts[0].id}`);
    await expect(reviewBanner(viewer)).toHaveCount(0);
  },
);
