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
import { ReactNode, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Grid } from '@superset-ui/core/components';
import MobileUnsupported from 'src/pages/MobileUnsupported';

const { useBreakpoint } = Grid;

/**
 * Routes that are supported on mobile devices.
 * All other routes will show the MobileUnsupported page on mobile.
 */
export const MOBILE_SUPPORTED_ROUTES: RegExp[] = [
  // Authentication
  /^\/login\/?$/,
  /^\/logout\/?$/,
  /^\/register\/?/,

  // Welcome / Home page
  /^\/superset\/welcome\/?$/,

  // Dashboard list and individual dashboards
  /^\/dashboard\/list\/?$/,
  /^\/superset\/dashboard\/[^/]+\/?$/,

  // The mobile unsupported page itself
  /^\/mobile-unsupported\/?$/,

  // User info
  /^\/user_info\/?$/,
];

/**
 * Check if a given path is supported on mobile
 */
export function isMobileSupportedRoute(path: string): boolean {
  // Remove query string and hash for matching
  const cleanPath = path.split(/[?#]/)[0];
  return MOBILE_SUPPORTED_ROUTES.some(pattern => pattern.test(cleanPath));
}

interface MobileRouteGuardProps {
  children: ReactNode;
}

/**
 * A component that wraps route content and redirects to the
 * MobileUnsupported page when accessing non-mobile-friendly
 * routes on mobile devices.
 *
 * Users can bypass this by clicking "Continue anyway" which
 * sets a sessionStorage flag.
 */
function MobileRouteGuard({ children }: MobileRouteGuardProps) {
  const screens = useBreakpoint();
  const location = useLocation();
  const [bypassEnabled, setBypassEnabled] = useState(() => {
    try {
      return sessionStorage.getItem('mobile-bypass') === 'true';
    } catch {
      return false;
    }
  });

  // Check for bypass flag when location changes
  useEffect(() => {
    try {
      const bypass = sessionStorage.getItem('mobile-bypass') === 'true';
      setBypassEnabled(bypass);
    } catch {
      // Storage access denied, keep current state
    }
  }, [location.pathname]);

  // Determine if we're on mobile (< md breakpoint = < 768px)
  const isMobile = !screens.md;

  // If not mobile, or bypass is enabled, render children normally
  if (!isMobile || bypassEnabled) {
    return <>{children}</>;
  }

  // Check if the current route is mobile-supported
  const isSupported = isMobileSupportedRoute(location.pathname);

  // If route is supported on mobile, render children
  if (isSupported) {
    return <>{children}</>;
  }

  // Otherwise, show the mobile unsupported page
  return (
    <MobileUnsupported originalPath={location.pathname + location.search} />
  );
}

export default MobileRouteGuard;
