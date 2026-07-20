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
import { ReactNode } from 'react';
import { useIsMobile } from 'src/hooks/useIsMobile';
import MobileUnsupported from 'src/pages/MobileUnsupported';

interface MobileRouteGuardProps {
  children: ReactNode;
  /**
   * Whether the wrapped route is part of the mobile consumption
   * experience. Set via the `mobileSupported` flag on the route
   * definition in `src/views/routes.tsx`.
   */
  mobileSupported?: boolean;
}

/**
 * Wraps route content and shows the MobileUnsupported page when a
 * non-mobile-friendly route is accessed on a small screen with
 * MOBILE_CONSUMPTION_MODE enabled. Growing the viewport past the
 * breakpoint unblocks the route automatically.
 */
function MobileRouteGuard({
  children,
  mobileSupported,
}: MobileRouteGuardProps) {
  const isMobile = useIsMobile();

  if (!isMobile || mobileSupported) {
    return <>{children}</>;
  }

  return <MobileUnsupported />;
}

export default MobileRouteGuard;
