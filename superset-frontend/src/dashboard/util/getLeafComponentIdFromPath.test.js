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
import getLeafComponentIdFromPath from 'src/dashboard/util/getLeafComponentIdFromPath';
import { filterId } from 'spec/fixtures/mockSliceEntities';
import { dashboardFilters } from 'spec/fixtures/mockDashboardFilters';

describe('getLeafComponentIdFromPath', () => {
  const path = dashboardFilters[filterId].directPathToFilter;
  const leaf = path.slice().pop();

  it('should return component id', () => {
    expect(getLeafComponentIdFromPath(path)).toBe(leaf);
  });

  it('should not return label component', () => {
    const updatedPath =
      dashboardFilters[filterId].directPathToFilter.concat('LABEL-test123');
    expect(getLeafComponentIdFromPath(updatedPath)).toBe(leaf);
  });
});
