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
import { Page, test } from '@playwright/test';

/**
 * Read a feature flag the way the application itself does.
 *
 * The server injects the flag map into the page bootstrap and the frontend
 * consults `window.featureFlags` via `isFeatureEnabled`, so this is the same
 * signal that decides whether flag-gated UI renders. A Superset page must
 * already be loaded.
 */
export async function isFeatureEnabled(
  page: Page,
  flag: string,
): Promise<boolean> {
  // The bootstrap runs as part of the bundle, so the map can be absent for a
  // moment after the load event. Wait for it rather than racing: reading too
  // early would report every flag as off, which for a skip guard means
  // silently standing down on an instance where the feature is in fact on.
  await page.waitForFunction(
    () =>
      Boolean(
        (window as unknown as { featureFlags?: Record<string, boolean> })
          .featureFlags,
      ),
    undefined,
    { timeout: 30000 },
  );
  return page.evaluate(
    name =>
      Boolean(
        (window as unknown as { featureFlags?: Record<string, boolean> })
          .featureFlags?.[name],
      ),
    flag,
  );
}

/**
 * Stand down when `flag` is off on the instance under test.
 *
 * Features that ship dark behind a release toggle are not reachable in a
 * default CI run, so their end-to-end coverage cannot pass there. Skipping
 * says that plainly rather than failing on an element that was never meant to
 * render, and the specs still run for real against any instance with the flag
 * on — including once the toggle is flipped.
 *
 * Enabling such a flag for the whole Playwright run is not an alternative:
 * a flag that changes application behaviour also changes it for every other
 * spec sharing that server.
 *
 * Only a flag that is present and off causes a skip. If the flag map never
 * appears the probe throws instead, so a genuinely broken page fails loudly
 * rather than disguising itself as an empty run.
 */
export async function skipUnlessFeatureEnabled(
  page: Page,
  flag: string,
  probeUrl = 'chart/list/',
): Promise<void> {
  await page.goto(probeUrl);
  test.skip(
    !(await isFeatureEnabled(page, flag)),
    `${flag} is disabled on this instance, so its UI is not rendered.`,
  );
}
