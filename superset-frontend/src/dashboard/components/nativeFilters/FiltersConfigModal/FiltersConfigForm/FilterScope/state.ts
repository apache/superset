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
import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { t } from '@superset-ui/core';
import { Charts, Layout, RootState } from 'src/dashboard/types';
import { DASHBOARD_ROOT_ID } from 'src/dashboard/util/constants';
import {
  CHART_TYPE,
  DASHBOARD_ROOT_TYPE,
} from 'src/dashboard/util/componentTypes';
import { BuildTreeLeafTitle, TreeItem } from './types';
import { buildTree } from './utils';

// eslint-disable-next-line import/prefer-default-export
export function useFilterScopeTree(
  currentChartId: number | undefined,
  initiallyExcludedCharts: number[] = [],
  buildTreeLeafTitle: BuildTreeLeafTitle = label => label,
  title = t('All panels'),
): {
  treeData: [TreeItem];
  layout: Layout;
} {
  const layout = useSelector<RootState, Layout>(
    ({ dashboardLayout: { present } }) => present,
  );

  const charts = useSelector<RootState, Charts>(({ charts }) => charts);
  const tree = {
    children: [],
    key: DASHBOARD_ROOT_ID,
    type: DASHBOARD_ROOT_TYPE,
    title,
  };

  // We need to get only nodes that have charts as children or grandchildren
  const validNodes = useMemo(
    () =>
      Object.values(layout).reduce<string[]>((acc, cur) => {
        const { id, parents = [], type, meta } = cur;
        if (type === CHART_TYPE && currentChartId !== meta?.chartId) {
          return [...new Set([...acc, ...parents, id])];
        }
        return acc;
      }, []),
    [layout, currentChartId],
  );

  useMemo(() => {
    buildTree(
      layout[DASHBOARD_ROOT_ID],
      tree,
      layout,
      charts,
      validNodes,
      initiallyExcludedCharts,
      buildTreeLeafTitle,
    );
  }, [layout, tree, charts, initiallyExcludedCharts, buildTreeLeafTitle]);

  return { treeData: [tree], layout };
}
