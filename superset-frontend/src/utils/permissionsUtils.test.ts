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

import * as featureFlags from 'src/featureFlags';
import { canAddReports } from './permissionsUtils';

describe('permissions utils', () => {
  let isFeatureEnabledMock: any;

  beforeEach(async () => {
    isFeatureEnabledMock = jest
      .spyOn(featureFlags, 'isFeatureEnabled')
      .mockImplementation(() => true);
  });

  afterEach(() => {
    isFeatureEnabledMock.mockRestore();
  });

  it('can add reports', () => {
    const user = {
      roles: {
        Admin: [['menu_access', 'Manage']],
      },
    };
    expect(canAddReports(user as any)).toBe(true);
  });

  it('cannot add reports', () => {
    const user = {
      roles: {
        Admin: [['some_permission', 'View']],
      },
    };
    expect(canAddReports(user as any)).toBe(false);
  });

  it('cannot add reports - no roles', () => {
    const user = {};
    expect(canAddReports(user as any)).toBe(false);
  });
});
