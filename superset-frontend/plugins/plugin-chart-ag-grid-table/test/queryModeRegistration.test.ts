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
import {
  FeatureFlag,
  getChartMetadataRegistry,
  VizType,
} from '@superset-ui/core';
import MainPreset from '../../../src/visualizations/presets/MainPreset';
import { isTreeQueryMode } from '../src/queryMode';

test.each([
  ['ag-grid-table', 'tree', true],
  ['table', 'tree', false],
  ['ag-grid-table', 'aggregate', false],
  ['ag-grid-table', 'raw', false],
  [undefined, 'tree', false],
])(
  'Tree detection requires the AG Grid identity: %s / %s',
  (vizType, queryMode, expected) => {
    expect(
      isTreeQueryMode({
        viz_type: vizType as string | undefined,
        query_mode: queryMode,
      }),
    ).toBe(expected);
  },
);

test.each([false, true])(
  'negative compatibility: no old tree_table registration with Tree flag %s',
  treeEnabled => {
    const flags = window.featureFlags;
    try {
      window.featureFlags = {
        ...flags,
        [FeatureFlag.AgGridTableEnabled]: true,
        [FeatureFlag.TableV2TreeModeEnabled]: treeEnabled,
      };
      new MainPreset().register();
      const registry = getChartMetadataRegistry();
      expect(registry.get(VizType.TableAgGrid)?.name).toBe('Table V2');
      expect(registry.get(VizType.TableAgGrid)?.queryObjectCount).toBe(1);
      expect(registry.get(VizType.TableAgGrid)?.enableNoResults).not.toBe(
        false,
      );
      expect(registry.has('tree_table')).toBe(false);
      expect(registry.has(VizType.Table)).toBe(true);
    } finally {
      window.featureFlags = flags;
      getChartMetadataRegistry().clear();
    }
  },
);
