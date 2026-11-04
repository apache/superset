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
 * A list page is also a place changes are made: the properties dialog
 * saves from the row it sits on. The row's review state was fetched when
 * the list mounted, so it was stale the moment that save was captured --
 * the row went on showing no tag at all until the page was reloaded.
 *
 * Both halves matter and they pull in opposite directions: the tag has to
 * appear (something changed) while the name must not (nothing is live
 * yet).
 *
 * Covers row 10 (NEW-3 / NEW-11), on the chart list and the dashboard
 * list.
 */
import { Locator, Page } from '@playwright/test';
import { apiGet } from '../../helpers/api/requests';
import { requireOpenChange } from '../../helpers/api/changeRequest';
import { URL } from '../../utils/urls';
import { TIMEOUT } from '../../utils/constants';
import {
  createGovernedChart,
  createGovernedDashboard,
  documentNeverReloaded,
  expect,
  goTo,
  markDocument,
  reviewTest,
} from './asset-approval-helpers';

const REVIEW_TAG = '[data-test="review-status-tag"]';

/** The row for an asset named `name`, once the list has drawn it. */
async function rowFor(page: Page, name: string): Promise<Locator> {
  const row = page.locator('tbody tr').filter({ hasText: name });
  await expect(row, `the list shows a row for ${name}`).toHaveCount(1, {
    timeout: TIMEOUT.PAGE_LOAD,
  });
  return row;
}

/**
 * Open the row's properties dialog from its hover actions.
 *
 * The dialog is the surface this row is about: it is the only place a
 * governed save is made from a list.
 */
async function openRowProperties(
  page: Page,
  row: Locator,
  modalTestId: string,
): Promise<void> {
  await row.hover();
  await row.locator('[data-test="edit-alt"]').click();
  await expect(page.locator(`[data-test="${modalTestId}"]`)).toBeVisible({
    timeout: TIMEOUT.FORM_LOAD,
  });
}

reviewTest(
  'row 10 [NEW-3 / NEW-11]: a capture made from a chart-list row tags that row without a reload and keeps the live name',
  async ({ review }) => {
    reviewTest.setTimeout(3 * TIMEOUT.SLOW_TEST);
    const author = await review.as('alex');
    const chart = await createGovernedChart(review, { label: 'row10-chart' });

    await goTo(author, URL.CHART_LIST);
    const row = await rowFor(author, chart.name);
    // Nothing pending yet, so no tag.
    await expect(row.locator(REVIEW_TAG)).toHaveCount(0);

    await openRowProperties(author, row, 'properties-edit-modal');
    const proposedName = `${chart.name}-proposed`;
    await author
      .locator('[data-test="properties-modal-name-input"]')
      .fill(proposedName);

    await markDocument(author);
    const save = author.waitForResponse(
      response =>
        response.request().method() === 'PUT' &&
        response.url().includes(`/api/v1/chart/${chart.id}`),
    );
    await author
      .locator('[data-test="properties-edit-modal"] [data-test="modal-confirm-button"]')
      .click();
    expect(
      (await save).status(),
      'the rename from the list row is held for review',
    ).toBe(202);

    // The tag arrives on its own.
    await expect(row.locator(REVIEW_TAG)).toHaveCount(1, {
      timeout: TIMEOUT.PAGE_LOAD,
    });
    await expect(row.locator(REVIEW_TAG)).toHaveText('Changes pending');
    await documentNeverReloaded(author);

    // ...and the row still names the chart as viewers find it.
    await expect(row.getByRole('link', { name: chart.name })).toBeVisible();
    await expect(row).not.toContainText(proposedName);
    const change = await requireOpenChange(author, 'chart', chart.id);
    expect(
      change.proposed.slice_name,
      'the proposed name is the one the row is not showing',
    ).toBe(proposedName);
  },
);

/** Capture a rename from the dashboard list's own properties dialog. */
async function captureFromDashboardRow(
  author: Page,
  dashboardId: number,
  liveTitle: string,
): Promise<{ row: Locator; proposedTitle: string }> {
  await goTo(author, URL.DASHBOARD_LIST);
  const row = await rowFor(author, liveTitle);
  await expect(row.locator(REVIEW_TAG)).toHaveCount(0);

  await openRowProperties(author, row, 'properties-edit-modal');
  const proposedTitle = `${liveTitle}-proposed`;
  await author.locator('[data-test="dashboard-title-input"]').fill(proposedTitle);

  await markDocument(author);
  const save = author.waitForResponse(
    response =>
      response.request().method() === 'PUT' &&
      response.url().includes(`/api/v1/dashboard/${dashboardId}`),
  );
  await author
    .locator('[data-test="properties-edit-modal"] [data-test="modal-confirm-button"]')
    .click();
  expect(
    (await save).status(),
    'the rename from the list row is held for review',
  ).toBe(202);
  return { row, proposedTitle };
}

reviewTest(
  'row 10 [NEW-3 / NEW-11]: a capture made from a dashboard-list row keeps the live name in that row',
  async ({ review }) => {
    reviewTest.setTimeout(3 * TIMEOUT.SLOW_TEST);
    const author = await review.as('alex');
    const dashboard = await createGovernedDashboard(review, {
      label: 'row10-dash',
    });
    const { row, proposedTitle } = await captureFromDashboardRow(
      author,
      dashboard.id,
      dashboard.title,
    );

    await expect(
      row.getByRole('link', { name: dashboard.title }),
    ).toBeVisible();
    await expect(row).not.toContainText(proposedTitle);
    const change = await requireOpenChange(author, 'dashboard', dashboard.id);
    expect(change.proposed.dashboard_title).toBe(proposedTitle);
  },
);

/**
 * The other half of row 10, on the dashboard list.
 *
 * This failed when the suite was written, and the test was left asserting
 * what the row asks for rather than softened to match. The chart list's
 * properties dialog announced its capture and the dashboard list's dialog
 * had no change-management awareness at all, so `useOpenChanges` was never
 * told to re-read and the row showed no tag until a reload.
 *
 * The dialog now handles a 202 the way the chart one does. The setup still
 * asserts the server reports the change before looking at the page, so a
 * failure here can only be the page not catching up.
 */
reviewTest(
  'row 10 [NEW-3 / NEW-11]: a capture made from a dashboard-list row tags that row without a reload',
  async ({ review }) => {
    reviewTest.setTimeout(3 * TIMEOUT.SLOW_TEST);
    const author = await review.as('alex');
    const dashboard = await createGovernedDashboard(review, {
      label: 'row10-dash-tag',
    });
    const { row } = await captureFromDashboardRow(
      author,
      dashboard.id,
      dashboard.title,
    );

    // The data the row needs is already there to be read.
    const open = await apiGet(author, 'api/v1/change_request/open/dashboard');
    expect(
      (await open.json()).result,
      'the server reports the dashboard as having an open change',
    ).toHaveProperty(String(dashboard.id), 'draft');

    await expect(row.locator(REVIEW_TAG)).toHaveCount(1, {
      timeout: TIMEOUT.PAGE_LOAD,
    });
    await expect(row.locator(REVIEW_TAG)).toHaveText('Changes pending');
    await documentNeverReloaded(author);
  },
);
