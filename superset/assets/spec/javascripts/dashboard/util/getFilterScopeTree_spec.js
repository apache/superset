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
import getFilterScopeNodesTree from '../../../../../../assets/src/dashboard/util/getFilterScopeNodesTree';

describe('getFilterScopeNodesTree', () => {
  it('should create scope tree for empty dashboard', () => {
    expect(getFilterScopeNodesTree({})).toEqual([]);
  });

  it('should create scope tree for simple grid dashboard', () => {
    const components = {
      'CHART-jJ5Yj1Ptaz': {
        children: [],
        id: 'CHART-jJ5Yj1Ptaz',
        meta: {
          chartId: 83,
          height: 50,
          sliceName: 'Growth Rate',
          width: 4
        },
        parents: [
          'ROOT_ID',
          'GRID_ID',
          'ROW-LCjsdSetJ'
        ],
        type: 'CHART'
      },
      'CHART-z4gmEuCqQ5': {
        children: [],
        id: 'CHART-z4gmEuCqQ5',
        meta: {
          chartId: 82,
          height: 50,
          sliceName: 'Region Filter',
          width: 4
        },
        parents: [
          'ROOT_ID',
          'GRID_ID',
          'ROW-LCjsdSetJ'
        ],
        type: 'CHART'
      },
      DASHBOARD_VERSION_KEY: 'v2',
      GRID_ID: {
        children: [
          'ROW-LCjsdSetJ'
        ],
        id: 'GRID_ID',
        parents: [
          'ROOT_ID'
        ],
        type: 'GRID'
      },
      HEADER_ID: {
        id: 'HEADER_ID',
        type: 'HEADER',
        meta: {
          text: 'filter scope'
        }
      },
      ROOT_ID: {
        children: [
          'GRID_ID'
        ],
        id: 'ROOT_ID',
        type: 'ROOT'
      },
      'ROW-LCjsdSetJ': {
        children: [
          'CHART-z4gmEuCqQ5',
          'CHART-jJ5Yj1Ptaz'
        ],
        id: 'ROW-LCjsdSetJ',
        meta: {
          background: 'BACKGROUND_TRANSPARENT'
        },
        parents: [
          'ROOT_ID',
          'GRID_ID'
        ],
        type: 'ROW'
      }
    };
    expect(getFilterScopeNodesTree(components)).toEqual([]);
  });

  it('should create scope tree for nested tabs dashboard', () => {

  });

});
