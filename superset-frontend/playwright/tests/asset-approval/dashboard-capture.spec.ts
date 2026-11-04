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
 * What a captured dashboard save leaves behind on the page it was saved
 * from: the header's title, and whether the page still thinks it has
 * unsaved work.
 *
 * Both rows are regressions of the same shape -- the save was held for
 * review, but the page went on behaving as though it had been applied (the
 * title) or as though it had not happened at all (the dirty flag). So both
 * drive the save through the real edit header rather than the API: the API
 * cannot reproduce either, because a fresh page load has no stale state to
 * get wrong.
 *
 * Covers rows 8 (NEW-2 / QA-19) and 9 (NEW-1).
 */
import { Page } from '@playwright/test';
import { requireOpenChange } from '../../helpers/api/changeRequest';
import { TIMEOUT } from '../../utils/constants';
import {
  createGovernedDashboard,
  documentNeverReloaded,
  expect,
  goTo,
  markDocument,
  reviewBanner,
  reviewTest,
  showChangesSwitch,
  type ReviewFixture,
} from './asset-approval-helpers';

const TITLE_INPUT = '[data-test="editable-title-input"]';

/**
 * Rename the dashboard through its edit header and save, which the gate
 * holds for review.
 */
async function renameAndSave(
  author: Page,
  dashboardId: number,
  proposedTitle: string,
): Promise<void> {
  await expect(author.locator('[data-test="edit-dashboard-button"]')).toBeVisible({
    timeout: TIMEOUT.PAGE_LOAD,
  });
  await author.locator('[data-test="edit-dashboard-button"]').click();

  const title = author.locator(TITLE_INPUT);
  await title.click();
  await title.fill(proposedTitle);
  await title.blur();
  await expect(author.locator('[data-test="header-save-button"]')).toBeEnabled({
    timeout: TIMEOUT.UI_TRANSITION,
  });

  const save = author.waitForResponse(
    response =>
      response.request().method() === 'PUT' &&
      response.url().includes(`/api/v1/dashboard/${dashboardId}`),
  );
  await markDocument(author);
  await author.locator('[data-test="header-save-button"]').click();
  const response = await save;
  expect(
    response.status(),
    'the dashboard save is held for review rather than applied',
  ).toBe(202);
}

async function governedDashboard(
  review: ReviewFixture,
  label: string,
): Promise<{ author: Page; dashboardId: number; liveTitle: string }> {
  const author = await review.as('alex');
  const { id, title } = await createGovernedDashboard(review, { label });
  await goTo(author, `dashboard/${id}/`);
  return { author, dashboardId: id, liveTitle: title };
}

/**
 * Row 8 [NEW-2 / QA-19] — the header and the banner must agree.
 *
 * The author's proposed title used to stay in the header while the banner
 * beside it said they and viewers were both on the live version, so the
 * screen contradicted itself about which version was on show. The switch
 * is what moves the header, in both directions.
 */
reviewTest(
  'row 8 [NEW-2 / QA-19]: after a captured save the header shows the live title, and the switch moves it to the proposal and back',
  async ({ review }) => {
    reviewTest.setTimeout(4 * TIMEOUT.SLOW_TEST);
    const { author, dashboardId, liveTitle } = await governedDashboard(
      review,
      'row8',
    );
    const proposedTitle = `${liveTitle}-proposed`;

    await renameAndSave(author, dashboardId, proposedTitle);

    const banner = reviewBanner(author);
    await expect(banner).toBeVisible({ timeout: TIMEOUT.PAGE_LOAD });
    await expect(banner).toContainText(
      'you and viewers are both seeing the live version',
    );
    // The header says the same thing the banner says.
    await expect(author.locator(TITLE_INPUT)).toHaveValue(liveTitle, {
      timeout: TIMEOUT.PAGE_LOAD,
    });
    // The proposal is on the server, so the header is not merely stale.
    const change = await requireOpenChange(author, 'dashboard', dashboardId);
    expect(change.proposed.dashboard_title).toBe(proposedTitle);

    await showChangesSwitch(author).click();
    await expect(author.locator(TITLE_INPUT)).toHaveValue(proposedTitle, {
      timeout: TIMEOUT.CHART_RENDER,
    });
    await expect(banner).toContainText('Viewing your changes');

    await showChangesSwitch(author).click();
    await expect(author.locator(TITLE_INPUT)).toHaveValue(liveTitle, {
      timeout: TIMEOUT.CHART_RENDER,
    });
    await expect(banner).toContainText(
      'you and viewers are both seeing the live version',
    );
    await documentNeverReloaded(author);
  },
);

/**
 * Row 9 [NEW-1] — a captured save is a finished save.
 *
 * Putting the live title back into the header is a tracked layout action,
 * so it used to mark the dashboard unsaved: the author was offered an Undo
 * for an edit they never made and warned on the way out that work would be
 * lost, after a save that had in fact completed.
 *
 * Asserted through navigation rather than by reading a flag. Chrome asks
 * before leaving a page whose `beforeunload` handler cancels, and
 * Playwright answers "stay" -- so a clean page navigates and a dirty one
 * does not get there. The second half of the test is the control that
 * proves the first half means something: with real unsaved edits in the
 * header, the same navigation is refused.
 */
reviewTest(
  'row 9 [NEW-1]: a captured dashboard save leaves no unsaved-changes prompt on the way out',
  async ({ review }) => {
    reviewTest.setTimeout(4 * TIMEOUT.SLOW_TEST);
    const { author, dashboardId, liveTitle } = await governedDashboard(
      review,
      'row9',
    );

    await renameAndSave(author, dashboardId, `${liveTitle}-proposed`);
    await expect(reviewBanner(author)).toBeVisible({
      timeout: TIMEOUT.PAGE_LOAD,
    });
    await expect(author.locator(TITLE_INPUT)).toHaveValue(liveTitle, {
      timeout: TIMEOUT.PAGE_LOAD,
    });

    // A real click, so the page has the user activation Chrome requires
    // before it will put up the dialog at all.
    await author.mouse.click(4, 4);

    const dialogs: string[] = [];
    author.on('dialog', dialog => dialogs.push(dialog.type()));
    await goTo(author, 'chart/list/');
    await expect(author).toHaveURL(/chart\/list/, {
      timeout: TIMEOUT.PAGE_LOAD,
    });
    expect(
      dialogs,
      'leaving the page after a captured save asks nothing',
    ).toEqual([]);

    // Control: with genuinely unsaved edits the same navigation is
    // refused, which is what makes the assertion above mean something.
    await goTo(author, `dashboard/${dashboardId}/`);
    await expect(
      author.locator('[data-test="edit-dashboard-button"]'),
    ).toBeVisible({ timeout: TIMEOUT.PAGE_LOAD });
    await author.locator('[data-test="edit-dashboard-button"]').click();
    const title = author.locator(TITLE_INPUT);
    await title.click();
    await title.fill(`${liveTitle}-unsaved`);
    await title.blur();
    await expect(
      author.locator('[data-test="header-save-button"]'),
    ).toBeEnabled({ timeout: TIMEOUT.UI_TRANSITION });
    await author.mouse.click(4, 4);

    await expect(
      author.goto('chart/list/', {
        waitUntil: 'domcontentloaded',
        timeout: TIMEOUT.API_RESPONSE,
      }),
      'an actually-dirty dashboard does block the way out',
      // Either shape means blocked: Playwright answers the prompt with
      // "stay", which leaves the navigation to be abandoned (ERR_ABORTED)
      // or simply never to complete.
    ).rejects.toThrow(/ERR_ABORTED|Timeout/);
  },
);
