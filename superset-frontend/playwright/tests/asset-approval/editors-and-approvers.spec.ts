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
 * Getting a second editor onto an asset, which is the only way out of
 * "nobody can approve this".
 *
 * Editorship is the whole control: there is no admin bypass and no
 * role-level approval grant, so an asset with one editor has a change
 * nobody may decide. SOW 5.4 makes adding an editor the documented escape,
 * and the editors list is exempt from review precisely so that escape is
 * not itself blocked by the thing it unblocks.
 *
 * Covers rows 11 (NEW-9) and 12 (NEW-10).
 */
import { apiGet } from '../../helpers/api/requests';
import { TIMEOUT } from '../../utils/constants';
import { URL } from '../../utils/urls';
import {
  APPROVER_NAME,
  AUTHOR_NAME,
  captureChartChange,
  createGovernedChart,
  documentNeverReloaded,
  expect,
  goTo,
  markDocument,
  modalDialog,
  reviewBanner,
  reviewTest,
} from './asset-approval-helpers';

/**
 * Row 11 [NEW-9] — the Editors picker has to be searchable by name.
 *
 * It is an async picker over subjects, and its own helper text promises
 * "Searchable by name"; typing a name found nothing, which left the author
 * no way to reach the person they needed.
 */
reviewTest(
  'row 11 [NEW-9]: the Editors picker in the properties dialog finds a person by name',
  async ({ review }) => {
    reviewTest.setTimeout(2 * TIMEOUT.SLOW_TEST);
    const author = await review.as('alex');
    const chart = await createGovernedChart(review, {
      label: 'row11',
      editors: [AUTHOR_NAME],
    });

    await goTo(author, URL.CHART_LIST);
    const row = author.locator('tbody tr').filter({ hasText: chart.name });
    await expect(row).toHaveCount(1, { timeout: TIMEOUT.PAGE_LOAD });
    await row.hover();
    await row.locator('[data-test="edit-alt"]').click();

    const dialog = author.locator('[data-test="properties-edit-modal"]');
    await expect(dialog).toBeVisible({ timeout: TIMEOUT.FORM_LOAD });

    const editors = dialog.getByRole('combobox', { name: 'Editors' });
    await editors.click();
    await editors.fill('Priya');

    await expect(
      author.locator('.ant-select-item-option').filter({ hasText: APPROVER_NAME }),
      'typing a name offers that person',
    ).toHaveCount(1, { timeout: TIMEOUT.API_RESPONSE });

    // A name nobody has offers nothing, so the match above is a search
    // result rather than the whole list rendered regardless.
    await editors.fill('Nobodyatall');
    await expect(
      author.locator('.ant-select-item-option').filter({ hasText: APPROVER_NAME }),
    ).toHaveCount(0, { timeout: TIMEOUT.API_RESPONSE });
  },
);

/**
 * Row 12 [NEW-10] — the dialog says who can approve, and keeps up.
 *
 * On a single-editor asset it has to say plainly that nobody can, rather
 * than let the author press a button that the server answers with a 422.
 * Adding an editor from inside the dialog is what fixes it, and the list
 * of approvers has to catch up there and then -- it is recomputed on the
 * server from the editors, so the dialog has to re-read rather than wait
 * for a reload.
 */
reviewTest(
  'row 12 [NEW-10]: a single-editor asset says nobody can approve, and names the new editor without a reload',
  async ({ review }) => {
    reviewTest.setTimeout(3 * TIMEOUT.SLOW_TEST);
    const author = await review.as('alex');
    const chart = await createGovernedChart(review, {
      label: 'row12',
      editors: [AUTHOR_NAME],
    });
    await captureChartChange(author, chart.id, {
      slice_name: `${chart.name}-proposed`,
    });

    await goTo(author, `explore/?slice_id=${chart.id}`);
    const banner = reviewBanner(author);
    await expect(banner).toBeVisible({ timeout: TIMEOUT.EXPLORE_PAGE_LOAD });
    await banner.getByRole('button', { name: 'Request review' }).click();

    const dialog = modalDialog(author, 'request-review-modal');
    await expect(dialog).toBeVisible({ timeout: TIMEOUT.FORM_LOAD });
    await expect(dialog).toContainText(
      'No one else can approve this chart. Add another editor to submit.',
    );
    await expect(
      dialog.locator('[data-test="modal-confirm-button"]'),
      'there is nothing to submit to, so submitting is not offered',
    ).toBeDisabled();

    await markDocument(author);
    const editors = dialog.getByRole('combobox', { name: 'Editors' });
    await editors.click();
    await editors.fill('Priya');
    await author
      .locator('.ant-select-item-option')
      .filter({ hasText: APPROVER_NAME })
      .first()
      .click();

    // The dialog now names the person who can approve, in place.
    await expect(dialog, 'the new editor is named as an approver').toContainText(
      APPROVER_NAME,
      { timeout: TIMEOUT.API_RESPONSE },
    );
    await expect(dialog).not.toContainText('No one else can approve this chart');
    await expect(
      dialog.locator('[data-test="modal-confirm-button"]'),
    ).toBeEnabled();
    await documentNeverReloaded(author);

    // The way out really was taken: the editor change applied directly
    // rather than becoming a second thing needing approval.
    const detail = await apiGet(author, `api/v1/chart/${chart.id}`);
    const bound: { label?: string }[] = (await detail.json()).result.editors ?? [];
    expect(bound.map(subject => subject.label).sort()).toEqual(
      [AUTHOR_NAME, APPROVER_NAME].sort(),
    );
  },
);
