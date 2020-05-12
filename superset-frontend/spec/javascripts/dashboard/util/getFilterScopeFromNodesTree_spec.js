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
import getFilterScopeFromNodesTree from 'src/dashboard/util/getFilterScopeFromNodesTree';

describe('getFilterScopeFromNodesTree', () => {
  it('should return empty scope', () => {
    const nodes = [];
    expect(
      getFilterScopeFromNodesTree({
        filterKey: '107_region',
        nodes,
        checkedChartIds: [],
      }),
    ).toEqual({});
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
          {
            label: 'Time Filter',
            showCheckbox: false,
            type: 'CHART',
            value: 108,
          },
        ],
      },
    ];
    const checkedChartIds = [104, 106];
    expect(
      getFilterScopeFromNodesTree({
        filterKey: '108___time_range',
        nodes,
        checkedChartIds,
      }),
    ).toEqual({
      scope: ['ROOT_ID'],
      immune: [105],
    });
  });

  describe('should return scope for tabbed dashboard', () => {
    const nodes = [
      {
        label: 'All dashboard',
        type: 'ROOT',
        value: 'ROOT_ID',
        children: [
          {
            label: 'Tab 1',
            type: 'TAB',
            value: 'TAB-Rb5aaqKWgG',
            children: [
              {
                label: 'Geo Filters',
                showCheckbox: false,
                type: 'CHART',
                value: 107,
              },
              {
                label: "World's Pop Growth",
                showCheckbox: true,
                type: 'CHART',
                value: 106,
              },
            ],
          },
          {
            label: 'Tab 2',
            type: 'TAB',
            value: 'TAB-w5Fp904Rs',
            children: [
              {
                label: 'Time Filter',
                showCheckbox: true,
                type: 'CHART',
                value: 108,
              },
              {
                label: 'Life Expectancy VS Rural %',
                showCheckbox: true,
                type: 'CHART',
                value: 104,
              },
              {
                label: 'Row Tab 1',
                type: 'TAB',
                value: 'TAB-E4mJaZ-uQM',
                children: [
                  {
                    value: 105,
                    label: 'Rural Breakdown',
                    type: 'CHART',
                    showCheckbox: true,
                  },
                  {
                    value: 103,
                    label: '% Rural',
                    type: 'CHART',
                    showCheckbox: true,
                  },
                ],
              },
              {
                value: 'TAB-rLYu-Cryu',
                label: 'New Tab',
                type: 'TAB',
                children: [
                  {
                    value: 102,
                    label: 'Most Populated Countries',
                    type: 'CHART',
                    showCheckbox: true,
                  },
                  {
                    value: 101,
                    label: "World's Population",
                    type: 'CHART',
                    showCheckbox: true,
                  },
                ],
              },
            ],
          },
        ],
      },
    ];

    it('root level tab scope', () => {
      const checkedChartIds = [106];
      expect(
        getFilterScopeFromNodesTree({
          filterKey: '107_region',
          nodes,
          checkedChartIds,
        }),
      ).toEqual({
        scope: ['TAB-Rb5aaqKWgG'],
        immune: [],
      });
    });

    it('global scope', () => {
      const checkedChartIds = [106, 104, 101, 102, 103, 105];
      expect(
        getFilterScopeFromNodesTree({
          filterKey: '107_country_name',
          nodes,
          checkedChartIds,
        }),
      ).toEqual({
        scope: ['ROOT_ID'],
        immune: [108],
      });
    });

    it('row level tab scope', () => {
      const checkedChartIds = [103, 105];
      expect(
        getFilterScopeFromNodesTree({
          filterKey: '108___time_range',
          nodes,
          checkedChartIds,
        }),
      ).toEqual({
        scope: ['TAB-E4mJaZ-uQM'],
        immune: [],
      });
    });

    it('mixed row level and root level scope', () => {
      const checkedChartIds = [103, 105, 106];
      expect(
        getFilterScopeFromNodesTree({
          filterKey: '107_region',
          nodes,
          checkedChartIds,
        }),
      ).toEqual({
        scope: ['TAB-Rb5aaqKWgG', 'TAB-E4mJaZ-uQM'],
        immune: [],
      });
    });

    it('mixed row level tab and chart scope', () => {
      const checkedChartIds = [103, 105, 102];
      expect(
        getFilterScopeFromNodesTree({
          filterKey: '107_region',
          nodes,
          checkedChartIds,
        }),
      ).toEqual({
        scope: ['TAB-E4mJaZ-uQM', 'TAB-rLYu-Cryu'],
        immune: [101],
      });
    });
  });
});
