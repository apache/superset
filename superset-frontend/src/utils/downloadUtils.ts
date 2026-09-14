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
import { FeatureFlag, isFeatureEnabled } from '@superset-ui/core';
import { t } from '@apache-superset/core/translation';
import { logging } from '@apache-superset/core/utils';
import {
  addInfoToast,
  addWarningToast,
} from 'src/components/MessageToasts/actions';
import {
  FORCE_IN_VIEW_EVENT,
  RESTORE_VIRTUALIZATION_EVENT,
} from 'src/dashboard/constants';

// Rows carry a `data-row-id` attribute (see Row.tsx) so the export path can
// target a subset of them per batch. How many rows get forced into view at
// once: large enough that a small dashboard finishes in one batch, small
// enough that a dashboard with hundreds of rows doesn't fire hundreds of
// chart queries in the same tick, which is the exact thundering-herd load
// DASHBOARD_VIRTUALIZATION exists to prevent in the first place.
const FORCE_RENDER_BATCH_SIZE = 5;
// Upper bound on how long a single batch is given to finish loading before
// moving on to the next one. Intentionally shorter than the final,
// whole-container timeout below: a slow chart in one batch shouldn't stall
// every later batch, since the final check catches stragglers anyway.
const BATCH_LOAD_TIMEOUT_MS = 10_000;
// Overall budget for the whole force-load pass (every batch wait plus the
// final whole-container check combined). Without this, a dashboard with
// many permanently-stalled batches could burn its full per-batch timeout
// on each one, plus another full timeout on the final check, keeping the
// export blocked far longer than any single timeout value suggests.
const OVERALL_LOAD_TIMEOUT_MS = 60_000;

export type ForceLoadProgress = {
  loadedBatches: number;
  totalBatches: number;
};

/**
 * Poll until all `.loading` spinners inside a container disappear,
 * indicating that lazy-loaded charts have finished rendering.
 * Returns true if all charts loaded, false if timed out.
 */
function waitForChartsToLoad(
  container: Element,
  timeoutMs = 60_000,
): Promise<boolean> {
  return new Promise(resolve => {
    const startTime = Date.now();
    const check = () => {
      const loadingElements = container.querySelectorAll('.loading');
      if (loadingElements.length === 0) {
        resolve(true);
        return;
      }
      if (Date.now() - startTime > timeoutMs) {
        logging.warn(
          `Timed out waiting for ${loadingElements.length} chart(s) to load`,
        );
        resolve(false);
        return;
      }
      setTimeout(check, 500);
    };
    setTimeout(check, 1000);
  });
}

/**
 * Poll until none of the given row elements contain a `.loading` spinner.
 * Scoped to just those rows (rather than the whole container, like
 * waitForChartsToLoad above) so a chart stuck in an earlier batch doesn't
 * force every later batch to also burn its full timeout re-checking that
 * same stale spinner. Resolves (doesn't reject) either way; a straggler
 * here is still caught by the final whole-container check afterwards.
 */
function waitForRowsToLoad(rows: Element[], timeoutMs: number): Promise<void> {
  return new Promise(resolve => {
    const startTime = Date.now();
    const check = () => {
      const stillLoading = rows.some(row => row.querySelector('.loading'));
      if (!stillLoading || Date.now() - startTime > timeoutMs) {
        resolve();
        return;
      }
      setTimeout(check, 500);
    };
    setTimeout(check, 1000);
  });
}

function getRowElements(container: Element): Element[] {
  return Array.from(container.querySelectorAll('[data-row-id]'));
}

function getRowId(row: Element): string | null {
  return row.getAttribute('data-row-id');
}

function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size));
  }
  return batches;
}

/**
 * When DASHBOARD_VIRTUALIZATION is enabled, forces lazy-loaded charts to
 * render in small batches (rather than all at once) and waits for them to
 * finish loading. Returns true if virtualization was active (caller must
 * restore it).
 */
export async function forceLoadAllCharts(
  container: Element,
  onProgress?: (progress: ForceLoadProgress) => void,
): Promise<boolean> {
  const useVirtualization = isFeatureEnabled(
    FeatureFlag.DashboardVirtualization,
  );
  if (useVirtualization) {
    const deadline = Date.now() + OVERALL_LOAD_TIMEOUT_MS;
    const rowElements = getRowElements(container);
    const rowBatches = rowElements.length
      ? chunk(rowElements, FORCE_RENDER_BATCH_SIZE)
      : [];

    if (rowBatches.length <= 1) {
      // Nothing to batch (no rows found, or everything fits in one batch):
      // force everything into view in a single pass, same as before batching.
      window.dispatchEvent(new Event(FORCE_IN_VIEW_EVENT));
    } else {
      addInfoToast(
        t('Preparing %(count)s charts for export. This may take a moment.', {
          count: rowElements.length,
        }),
      );
      // eslint-disable-next-line no-restricted-syntax -- batches must be
      // dispatched sequentially so the query burst is actually staggered.
      for (const [index, batch] of rowBatches.entries()) {
        const rowIds = batch
          .map(getRowId)
          .filter((id): id is string => id !== null);
        window.dispatchEvent(
          new CustomEvent(FORCE_IN_VIEW_EVENT, { detail: { rowIds } }),
        );
        // Never wait longer than what's left of the overall budget, so a
        // string of stalled batches can't each burn a full per-batch
        // timeout and blow past the deadline in aggregate.
        const remainingMs = Math.max(0, deadline - Date.now());
        // eslint-disable-next-line no-await-in-loop -- see above
        await waitForRowsToLoad(
          batch,
          Math.min(BATCH_LOAD_TIMEOUT_MS, remainingMs),
        );
        onProgress?.({
          loadedBatches: index + 1,
          totalBatches: rowBatches.length,
        });
      }
    }

    const allLoaded = await waitForChartsToLoad(
      container,
      Math.max(0, deadline - Date.now()),
    );
    if (!allLoaded) {
      addWarningToast(
        t('Some charts did not finish loading. The export may be incomplete.'),
      );
    }
  }
  return useVirtualization;
}

/**
 * Restores normal lazy loading behavior after a forced load.
 */
export function restoreVirtualization(): void {
  window.dispatchEvent(new Event(RESTORE_VIRTUALIZATION_EVENT));
}
