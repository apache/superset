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
 * Which card on a dashboard is marked when one of its charts has a change
 * open.
 *
 * The whole dashboard reads review state once and shares it, so the
 * failure mode is a map that is keyed wrong: every card marked, or the
 * right one marked with the proposed name on it. Exactly one card, showing
 * the live name, is what distinguishes a correct lookup from a plausible
 * one.
 *
 * Covers row 15 (QA-21).
 */
import { requireOpenChange } from '../../helpers/api/changeRequest';
import { TIMEOUT } from '../../utils/constants';
import {
  captureChartChange,
  createGovernedDashboardWithCharts,
  expect,
  goTo,
  reviewTest,
} from './asset-approval-helpers';

const REVIEW_TAG = '[data-test="review-status-tag"]';

reviewTest(
  'row 15 [QA-21]: exactly one chart card on the dashboard carries the tag, and it still shows the live chart name',
  async ({ review }) => {
    reviewTest.setTimeout(5 * TIMEOUT.SLOW_TEST);
    const author = await review.as('alex');
    const { dashboardId, charts } = await createGovernedDashboardWithCharts(
      review,
      { label: 'row15', chartCount: 2 },
    );
    const [changed, untouched] = charts;

    const proposedName = `${changed.name}-proposed`;
    await captureChartChange(author, changed.id, { slice_name: proposedName });
    const change = await requireOpenChange(author, 'chart', changed.id);
    expect(change.proposed.slice_name).toBe(proposedName);

    await goTo(author, `dashboard/${dashboardId}/`);
    const cards = author.locator('[data-test="chart-grid-component"]');
    await expect(cards, 'both charts are laid out').toHaveCount(2, {
      timeout: TIMEOUT.CHART_RENDER,
    });

    const changedCard = author.locator(
      `[data-test="chart-grid-component"][data-test-chart-id="${changed.id}"]`,
    );
    const untouchedCard = author.locator(
      `[data-test="chart-grid-component"][data-test-chart-id="${untouched.id}"]`,
    );

    await expect(
      changedCard.locator(REVIEW_TAG),
      'the chart with the open change is the one that is marked',
    ).toHaveCount(1, { timeout: TIMEOUT.PAGE_LOAD });
    await expect(changedCard.locator(REVIEW_TAG)).toHaveText('Changes pending');
    await expect(
      untouchedCard.locator(REVIEW_TAG),
      'the other chart is not marked',
    ).toHaveCount(0);
    await expect(
      author.locator(REVIEW_TAG),
      'and nothing else on the page is marked either',
    ).toHaveCount(1);

    // The card names the chart as viewers find it, not as the author
    // proposes to rename it.
    await expect(
      changedCard.locator('[data-test="slice-header"]'),
    ).toContainText(changed.name);
    await expect(
      changedCard.locator('[data-test="slice-header"]'),
    ).not.toContainText(proposedName);
  },
);
