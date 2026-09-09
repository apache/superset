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
 * End-to-end coverage for the Archive (Recently-Archived) view.
 *
 * Requires the running instance to have the SOFT_DELETE feature flag enabled.
 * The flag is off by default everywhere — including the docker dev stack — so
 * these specs skip unless the instance opts in; in CI that is the dedicated
 * "Soft-delete Tests" step in superset-e2e.yml, which boots its server with
 * SUPERSET_FEATURE_SOFT_DELETE=true. Each test creates a disposable object via
 * the authenticated REST API, soft-deletes it, then drives the real UI to
 * restore it and asserts — via the API — that it is live again.
 */
import { test, expect, Page } from '@playwright/test';
import { apiGet } from '../../helpers/api/requests';
import { extractIdFromResponse } from '../../helpers/api/assertions';
import {
  apiPostChart,
  apiGetChart,
  apiDeleteChart,
} from '../../helpers/api/chart';
import {
  apiPostDashboard,
  apiGetDashboard,
  apiDeleteDashboard,
} from '../../helpers/api/dashboard';
import {
  createTestVirtualDataset,
  apiGetDataset,
  apiDeleteDataset,
} from '../../helpers/api/dataset';
import { skipUnlessFeatureEnabled } from '../../helpers/featureFlags';

test.beforeEach(async ({ page }) => {
  await skipUnlessFeatureEnabled(page, 'SOFT_DELETE');
});

interface TypeConfig {
  key: string;
  label: string;
  create: (page: Page, name: string) => Promise<number>;
  softDelete: (page: Page, id: number) => Promise<{ ok: () => boolean }>;
  status: (page: Page, id: number) => Promise<number>;
}

async function anyDatasetId(page: Page): Promise<number> {
  const res = await apiGet(page, 'api/v1/dataset/?q=(page_size:1)');
  const body = await res.json();
  return body.result[0].id;
}

const TYPES: TypeConfig[] = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    create: async (page, name) =>
      extractIdFromResponse(
        await apiPostDashboard(page, { dashboard_title: name }),
      ),
    softDelete: (page, id) => apiDeleteDashboard(page, id),
    status: async (page, id) => (await apiGetDashboard(page, id)).status(),
  },
  {
    key: 'chart',
    label: 'Chart',
    create: async (page, name) => {
      const datasourceId = await anyDatasetId(page);
      const res = await apiPostChart(page, {
        slice_name: name,
        datasource_id: datasourceId,
        datasource_type: 'table',
        viz_type: 'table',
      });
      return extractIdFromResponse(res);
    },
    softDelete: (page, id) => apiDeleteChart(page, id),
    status: async (page, id) => (await apiGetChart(page, id)).status(),
  },
  {
    key: 'dataset',
    label: 'Dataset',
    create: async (page, name) => {
      const id = await createTestVirtualDataset(page, name);
      if (!id) throw new Error('failed to create virtual dataset');
      return id;
    },
    softDelete: (page, id) => apiDeleteDataset(page, id),
    status: async (page, id) => (await apiGetDataset(page, id)).status(),
  },
];

async function openArchive(page: Page, typeLabel: string, name: string) {
  await page.goto('archived/');
  await expect(page.getByTestId('archived-list-view')).toBeVisible();
  // Select the object type, then narrow to the unique name. The antd Select's
  // value chip overlays the combobox input, so force the click to open it, then
  // pick the option from the portal listbox.
  await page.getByRole('combobox', { name: 'Type' }).click({ force: true });
  await page.getByRole('option', { name: typeLabel, exact: true }).click();
  const search = page.getByPlaceholder(/type a value/i);
  await search.click();
  await search.fill(name);
  await search.press('Enter');
}

for (const cfg of TYPES) {
  test(`restores a soft-deleted ${cfg.key} from the archive`, async ({
    page,
  }) => {
    const name = `e2e_archive_${cfg.key}_${Date.now()}`;
    const id = await cfg.create(page, name);
    expect(id, 'created id').toBeTruthy();

    // Cleanup runs in finally so a mid-test failure cannot leave the
    // object live in the normal lists (already-archived → the extra
    // soft-delete just 404s and is swallowed).
    try {
      const del = await cfg.softDelete(page, id);
      expect(del.ok(), 'soft-delete should succeed').toBeTruthy();

      await openArchive(page, cfg.label, name);

      // The archived row is listed; restore it (scope to the named row so any
      // unrelated archived residue on the instance can't make the action ambiguous).
      const row = page.getByRole('row').filter({ hasText: name });
      await expect(row).toBeVisible();
      await row.getByTestId('archived-row-restore').click();

      // Success toast, and the object is live again per the API.
      await expect(
        page.getByText(`${name} restored successfully`, { exact: false }),
      ).toBeVisible({ timeout: 15000 });
      await expect.poll(() => cfg.status(page, id)).toBe(200);
    } finally {
      // Re-archive so it leaves the normal lists, whatever happened above.
      await cfg.softDelete(page, id).catch(() => {});
    }
  });
}

test('permanently deletes an archived item from the view', async ({ page }) => {
  const name = `e2e_purge_${Date.now()}`;
  const id = await TYPES[0].create(page, name); // dashboard

  // Cleanup runs in finally, same pattern as the restore tests: a mid-test
  // failure must not leave the dashboard live in the normal lists. On the
  // success path the purge already removed it and the extra soft-delete
  // 404s and is swallowed.
  try {
    expect((await TYPES[0].softDelete(page, id)).ok()).toBeTruthy();

    await openArchive(page, TYPES[0].label, name);
    const row = page.getByRole('row').filter({ hasText: name });
    await expect(row).toBeVisible();

    // "Delete permanently" keeps the platform's type-to-confirm gate — the
    // most destructive action on the page must not carry less friction than
    // an ordinary delete.
    await row.getByTestId('archived-row-purge').click();
    await page.getByTestId('delete-modal-input').fill('DELETE');
    await page.getByRole('button', { name: 'Delete', exact: true }).click();

    // Success toast, and the row is gone for good.
    await expect(page.getByText(`${name} deleted successfully`)).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByRole('row').filter({ hasText: name })).toHaveCount(
      0,
    );
  } finally {
    await TYPES[0].softDelete(page, id).catch(() => {});
  }
});
