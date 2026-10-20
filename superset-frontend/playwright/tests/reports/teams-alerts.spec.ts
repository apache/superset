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
import { test, expect } from '@playwright/test';
import { apiDelete } from '../../helpers/api/requests';

interface Destination {
  key: string;
  label: string;
  available: boolean;
}

// Requires ALERT_REPORTS, ALERT_REPORT_TEAMS and a deployment allowlist. No bot
// installation or live credential is needed: every saved schedule stays inactive.
test('creates and edits an inactive Teams alert and preserves unavailable destinations', async ({
  page,
}) => {
  test.setTimeout(90000);
  const configured = await page.request.get(
    'api/v1/report/teams_destinations/',
  );
  test.skip(
    configured.status() === 404,
    'Reports/Teams integration is disabled',
  );
  expect(configured.ok()).toBeTruthy();
  const { result: destinations }: { result: Destination[] } =
    await configured.json();
  test.skip(
    destinations.length === 0,
    'Configure at least one approved Teams destination',
  );
  const destination = destinations[0];
  let removed = false;
  let alertId: number | undefined;
  let executionRequests = 0;

  await page.route('**/api/v1/report/teams_destinations/', route =>
    route.fulfill({
      json: {
        result: removed
          ? []
          : destinations.map(item => ({ ...item, available: false })),
      },
    }),
  );
  // Exercise real schedule persistence, but reject an accidental active save or
  // execution request before it can reach the server.
  await page.route(/\/api\/v1\/report\/(?:\d+\/?)?$/, async route => {
    const request = route.request();
    if (['POST', 'PUT'].includes(request.method())) {
      const payload = request.postDataJSON() as {
        active: boolean;
        report_format: string;
        type: string;
      };
      expect(payload.active).toBe(false);
      expect(payload.report_format).toBe('NONE');
      expect(payload.type).toBe('Alert');
    }
    await route.continue();
  });
  await page.route(/\/api\/v1\/report\/\d+\/execute\/?(?:\?.*)?$/, route => {
    executionRequests += 1;
    return route.abort();
  });

  const name = `Teams inactive ${test.info().testId} ${Date.now()}`;
  try {
    await page.goto('alert/list/');
    await page
      .getByRole('button', { name: 'Alert', exact: true })
      .first()
      .click();
    const modal = page.getByTestId('alert-report-modal');
    await modal.getByPlaceholder('Enter alert name').fill(name);
    await modal.getByRole('switch').first().uncheck();
    await modal.getByTestId('alert-condition-panel').click();
    await modal
      .getByRole('combobox', { name: 'Database', exact: true })
      .click();
    await page.getByRole('option').first().click();
    await modal.locator('.ace_editor').click();
    await page.keyboard.insertText('SELECT 1');
    await modal
      .getByRole('combobox', { name: 'Condition', exact: true })
      .click();
    await page.getByRole('option', { name: 'Not null', exact: true }).click();
    await modal.getByTestId('contents-panel').click();
    const attachments = modal.getByRole('switch', {
      name: 'Include attachment',
    });
    if (await attachments.count()) await attachments.uncheck();
    await modal.getByTestId('schedule-panel').click();
    await expect(
      modal.getByRole('combobox', { name: 'Timezone selector' }),
    ).toBeVisible();
    await modal.getByTestId('notification-method-panel').click();
    await modal
      .getByRole('combobox', { name: 'Delivery method', exact: true })
      .click();
    await page.getByRole('option', { name: 'Teams', exact: true }).click();
    await modal.getByRole('combobox', { name: 'Teams destination' }).click();
    await page
      .getByRole('option', {
        name: `${destination.label} (Bot installation required)`,
        exact: true,
      })
      .click();
    await expect(modal.getByText(/Install the notification bot/)).toBeVisible();
    const created = page.waitForResponse(
      response =>
        response.request().method() === 'POST' &&
        new URL(response.url()).pathname.endsWith('/api/v1/report/'),
    );
    await modal.getByRole('button', { name: 'Add', exact: true }).click();
    const response = await created;
    expect(response.ok()).toBeTruthy();
    ({ id: alertId } = await response.json());
    expect(alertId).toBeDefined();
    await expect(modal).not.toBeVisible();

    const edit = async () => {
      await page.reload();
      const row = page
        .getByRole('row')
        .filter({ has: page.getByText(name, { exact: true }) });
      await row.getByLabel('edit-action', { exact: true }).click();
      await modal.getByTestId('notification-method-panel').click();
    };
    await edit();
    await expect(
      modal.getByText(`${destination.label} (Bot installation required)`, {
        exact: true,
      }),
    ).toBeVisible();
    await modal.getByTestId('general-information-panel').click();
    await expect(modal.getByRole('switch').first()).not.toBeChecked();
    await modal
      .locator('input[name="description"]')
      .fill('Updated without activating delivery');
    const updated = page.waitForResponse(
      result =>
        result.request().method() === 'PUT' &&
        new URL(result.url()).pathname.endsWith(`/report/${alertId}`),
    );
    await modal.getByRole('button', { name: 'Save', exact: true }).click();
    expect((await updated).ok()).toBeTruthy();
    const saved = await page.request.get(`api/v1/report/${alertId}`);
    const { result } = await saved.json();
    expect(result.active).toBe(false);
    expect(result.report_format).toBe('NONE');
    expect(result.recipients).toHaveLength(1);
    expect(result.recipients[0].type).toBe('Teams');
    expect(JSON.parse(result.recipients[0].recipient_config_json)).toEqual({
      target: destination.key,
    });

    removed = true;
    await edit();
    await expect(
      modal.getByText(`${destination.key} (Unavailable)`, { exact: true }),
    ).toBeVisible();
    await expect(
      modal.getByText(/This saved Teams destination is unavailable/),
    ).toBeVisible();
    await modal.getByRole('button', { name: 'Cancel', exact: true }).click();
    const unchanged = await page.request.get(`api/v1/report/${alertId}`);
    expect((await unchanged.json()).result.recipients).toEqual(
      result.recipients,
    );
    expect(executionRequests).toBe(0);
  } finally {
    if (alertId !== undefined) {
      const response = await apiDelete(page, `api/v1/report/${alertId}`);
      expect(response.ok()).toBeTruthy();
    }
  }
});
