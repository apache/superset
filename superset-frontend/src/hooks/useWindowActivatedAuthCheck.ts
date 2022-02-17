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

import { useEffect } from 'react';
import { makeApi } from '@superset-ui/core';
import { User } from 'src/types/bootstrapTypes';

const getMe = makeApi<void, User>({
  method: 'GET',
  endpoint: '/api/v1/me/',
});

/**
 * When the window becomes visible, checks for the current auth state.
 * If we get a 401, we are no longer logged in and the SupersetClient will redirect us.
 * This ensures that if you log out in browser tab A, and click to tab B,
 * tab B will also display as logged out.
 */
export function useWindowActivatedAuthCheck() {
  useEffect(() => {
    const listener = () => {
      // we only care about the tab becoming visible, not vice versa
      if (document.visibilityState !== 'visible') return;

      getMe().catch(() => {
        // ignore error, SupersetClient will redirect to login on a 401
      });
    };

    document.addEventListener('visibilitychange', listener);

    return () => {
      document.removeEventListener('visibilitychange', listener);
    };
  }, []);
}
