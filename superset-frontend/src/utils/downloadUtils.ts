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
import { addWarningToast } from 'src/components/MessageToasts/actions';
import {
  FORCE_IN_VIEW_EVENT,
  RESTORE_VIRTUALIZATION_EVENT,
} from 'src/dashboard/constants';

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
 * When DASHBOARD_VIRTUALIZATION is enabled, forces all lazy-loaded
 * charts to render and waits for them to finish loading.
 * Returns true if virtualization was active (caller must restore it).
 */
export async function forceLoadAllCharts(container: Element): Promise<boolean> {
  const useVirtualization = isFeatureEnabled(
    FeatureFlag.DashboardVirtualization,
  );
  if (useVirtualization) {
    window.dispatchEvent(new Event(FORCE_IN_VIEW_EVENT));
    const allLoaded = await waitForChartsToLoad(container);
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
