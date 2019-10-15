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
import getFilterScopeFromNodesTree from '../../../../src/dashboard/util/getFilterScopeFromNodesTree';

describe('getFilterScopeFromNodesTree', () => {
  it('should return empty dashboard', () => {
    const nodes = [];
    expect(
      getFilterScopeFromNodesTree({
        nodes,
        checkedChartIds: [],
      }),
    ).toEqual({
      scope: [],
      immune: [],
    });
  });

  it('should return scope for simple grid', () => {
    const nodes = [
      {
        label: 'All dashboard',
        type: 'ROOT',
        value: 'ROOT_ID',
        children: [
          {
            value: 104,
            label: 'Life Expectancy VS Rural %',
            type: 'CHART',
          },
          { value: 105, label: 'Rural Breakdown', type: 'CHART' },
          {
            value: 106,
            label: "World's Pop Growth",
            type: 'CHART',
          },
        ],
      },
    ];
    const checkedChartIds = [104, 106];
    expect(
      getFilterScopeFromNodesTree({
        nodes,
        checkedChartIds,
      }),
    ).toEqual({
      scope: ['ROOT_ID'],
      immune: [105],
    });
  });
});
