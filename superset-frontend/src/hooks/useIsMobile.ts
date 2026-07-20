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
import { useEffect, useState } from 'react';
import { FeatureFlag, isFeatureEnabled } from '@superset-ui/core';
import { useTheme } from '@apache-superset/core/theme';

// Matches antd's screenSMMax token; used only when no theme is in scope.
const FALLBACK_MOBILE_MAX_WIDTH = 767;

/**
 * Whether the mobile consumption-only experience is enabled for this
 * deployment. Non-hook variant for use inside styled-component
 * interpolations; prefer `useIsMobile` in components.
 */
export function isMobileConsumptionEnabled(): boolean {
  return isFeatureEnabled(FeatureFlag.MobileConsumptionMode);
}

/**
 * Returns true when MOBILE_CONSUMPTION_MODE is enabled AND the viewport is
 * at or below the theme's `screenSMMax` breakpoint. All mobile-specific
 * behavior (route guarding, consumption-only chrome, drawer navigation)
 * should key off this hook so the flag remains a single kill switch.
 *
 * The matchMedia subscription is only installed when the flag is on, and
 * state only changes when the match flips, so with the flag off (or on
 * desktop) this hook never causes a re-render — consumers are inert.
 *
 * The initial value is always false (desktop), so the first paint never
 * takes the mobile branch by accident.
 */
export function useIsMobile(): boolean {
  const enabled = isMobileConsumptionEnabled();
  const theme = useTheme();
  const maxWidth = theme?.screenSMMax ?? FALLBACK_MOBILE_MAX_WIDTH;
  const [isSmallScreen, setIsSmallScreen] = useState(false);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }
    const mediaQuery = window.matchMedia(`(max-width: ${maxWidth}px)`);
    const update = () => setIsSmallScreen(mediaQuery.matches);
    update();
    // Safari < 14 lacks addEventListener on MediaQueryList
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', update);
      return () => mediaQuery.removeEventListener('change', update);
    }
    mediaQuery.addListener(update);
    return () => mediaQuery.removeListener(update);
  }, [enabled, maxWidth]);

  return enabled && isSmallScreen;
}
