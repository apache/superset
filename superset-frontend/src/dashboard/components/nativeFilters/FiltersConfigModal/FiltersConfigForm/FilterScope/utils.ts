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
import { Charts, Layout, LayoutItem, Slice } from 'src/dashboard/types';
import {
  CHART_TYPE,
  DASHBOARD_ROOT_TYPE,
  TAB_TYPE,
} from 'src/dashboard/util/componentTypes';
import { DASHBOARD_ROOT_ID } from 'src/dashboard/util/constants';
import { t } from '@apache-superset/core/translation';
import { NativeFilterScope } from '@superset-ui/core';
import { logging } from '@apache-superset/core/utils';
import { BuildTreeLeafTitle, TreeItem } from './types';

export const isShowTypeInTree = ({ type }: LayoutItem) =>
  type === TAB_TYPE || type === CHART_TYPE || type === DASHBOARD_ROOT_TYPE;

export const getNodeTitle = (node: LayoutItem) =>
  node?.meta?.sliceNameOverride ??
  node?.meta?.sliceName ??
  node?.meta?.text ??
  node?.meta?.defaultText ??
  node?.id?.toString?.() ??
  '';

export const generateChartSubNodes = (
  chartId: number,
  chart: {
    form_data?: {
      viz_type?: string;
      deck_slices?: number[];
    };
  } & Partial<Pick<Charts[keyof Charts], 'queriesResponse'>>,
  buildTreeLeafTitle: BuildTreeLeafTitle,
  sliceEntities?: Record<number, Slice>,
): TreeItem[] => {
  const subNodes: TreeItem[] = [];

  if (chart?.form_data?.viz_type === 'deck_multi') {
    const deckSliceIds = chart?.form_data?.deck_slices || [];

    deckSliceIds.forEach((sliceId: number, index: number) => {
      let sliceName = `Slice ${sliceId}`;

      if (chart.queriesResponse?.[0]?.data?.slices) {
        const slice = chart.queriesResponse[0].data.slices.find(
          (s: { slice_id: number; slice_name?: string }) =>
            s.slice_id === sliceId,
        );
        if (slice?.slice_name) {
          sliceName = slice.slice_name;
        }
      }

      const sliceInfo = sliceEntities?.[sliceId];
      if (sliceInfo?.slice_name) {
        sliceName = sliceInfo.slice_name;
      }

      subNodes.push({
        key: `chart-${chartId}-layer-${index}`,
        title: buildTreeLeafTitle(
          sliceName,
          false,
          `Deck.gl layer: ${sliceName}`,
        ),
        children: [],
        nodeType: 'DECKGL_LAYER',
        chartId,
        layerType: sliceInfo?.viz_type || 'deck_layer',
      });
    });
  }

  return subNodes;
};

export const buildTree = (
  node: LayoutItem,
  treeItem: TreeItem,
  layout: Layout,
  charts: Charts,
  validNodes: string[],
  initiallyExcludedCharts: number[],
  buildTreeLeafTitle: BuildTreeLeafTitle,
  sliceEntities?: Record<number, Slice>,
  visited: Set<string> = new Set(),
) => {
  if (!node) {
    return;
  }

  let itemToPass: TreeItem = treeItem;
  if (
    node &&
    treeItem &&
    isShowTypeInTree(node) &&
    node.type !== DASHBOARD_ROOT_TYPE &&
    validNodes?.includes?.(node.id)
  ) {
    const title = buildTreeLeafTitle(
      getNodeTitle(node),
      initiallyExcludedCharts?.includes?.(node.meta?.chartId as number),
      t(
        "This chart might be incompatible with the filter (datasets don't match)",
      ),
      !!(
        node.type === CHART_TYPE &&
        node.meta?.chartId &&
        charts &&
        charts[node.meta.chartId]?.form_data?.viz_type === 'deck_multi'
      ),
    );

    const currentTreeItem: TreeItem = {
      key: node.id,
      title,
      children: [],
      nodeType: node.type === CHART_TYPE ? 'CHART' : 'TAB',
      chartId: node.meta?.chartId,
    };

    if (node.type === CHART_TYPE && node.meta?.chartId) {
      const chart = charts?.[node.meta.chartId];
      if (chart) {
        const subNodes = generateChartSubNodes(
          node.meta.chartId,
          chart,
          buildTreeLeafTitle,
          sliceEntities,
        );
        currentTreeItem.children = subNodes;
      }
    }

    treeItem.children.push(currentTreeItem);
    itemToPass = currentTreeItem;
  }

  if (node.type !== CHART_TYPE) {
    node?.children?.forEach?.(child => {
      if (visited.has(child)) {
        return;
      }
      visited.add(child);
      const childNode = layout?.[child];
      if (childNode) {
        buildTree(
          childNode,
          itemToPass,
          layout,
          charts,
          validNodes,
          initiallyExcludedCharts,
          buildTreeLeafTitle,
          sliceEntities,
          visited,
        );
      } else {
        logging.warn(
          `Unable to find item with id: ${child} in the dashboard layout. This may indicate you have invalid references in your dashboard and the references to id: ${child} should be removed.`,
        );
      }
    });
  }
};

const addInvisibleParents = (layout: Layout, item: string) => [
  ...(layout[item]?.children || []),
  ...Object.values(layout)
    .filter(
      val =>
        val.parents &&
        val.parents[val.parents.length - 1] === item &&
        !isShowTypeInTree(layout[val.parents[val.parents.length - 1]]),
    )
    .map(({ id }) => id),
];

const checkTreeItem = (
  checkedItems: string[],
  layout: Layout,
  items: string[],
  excluded: number[],
  visited: Set<string> = new Set(),
) => {
  items.forEach(item => {
    if (visited.has(item)) {
      return;
    }
    visited.add(item);
    checkTreeItem(
      checkedItems,
      layout,
      addInvisibleParents(layout, item),
      excluded,
      visited,
    );
    if (
      layout[item]?.type === CHART_TYPE &&
      !excluded.includes(layout[item]?.meta.chartId as number)
    ) {
      checkedItems.push(item);
    }
  });
};

const LAYER_KEY_REGEX = /^chart-(\d+)-layer-\d+$/;

export const getTreeCheckedItems = (
  scope: NativeFilterScope,
  layout: Layout,
  selectedLayers?: string[],
) => {
  const checkedItems: string[] = [];
  checkTreeItem(checkedItems, layout, [...scope.rootPath], [...scope.excluded]);

  // If we have individual layer selections, exclude their parent charts from checkedItems
  // to prevent Tree component from auto-checking all children
  if (selectedLayers && selectedLayers.length > 0) {
    const parentChartIds = new Set<number>();
    selectedLayers.forEach(layerKey => {
      const match = layerKey.match(LAYER_KEY_REGEX);
      if (match) {
        const chartId = parseInt(match[1], 10);
        parentChartIds.add(chartId);
      }
    });

    const filteredItems = checkedItems.filter(item => {
      if (layout[item]?.type === CHART_TYPE) {
        const chartId = layout[item]?.meta?.chartId;
        return chartId ? !parentChartIds.has(chartId) : true;
      }
      return true;
    });

    return [...new Set([...filteredItems, ...selectedLayers])];
  }

  return [...new Set(checkedItems)];
};

// Builds the scope of the selected charts/tabs as the dashboard root plus
// the charts to exclude
export const findFilterScope = (
  checkedKeys: string[],
  layout: Layout,
): NativeFilterScope => {
  if (!checkedKeys.length) {
    return {
      rootPath: [],
      excluded: [],
    };
  }

  const layerKeys = checkedKeys.filter(key => key.includes('-layer-'));
  const chartKeys = checkedKeys.filter(key => {
    if (layout[key]?.type === CHART_TYPE) {
      return true;
    }
    if (key.includes('-layer-')) {
      return false;
    }
    return true;
  });

  layerKeys.forEach(layerKey => {
    const match = layerKey.match(LAYER_KEY_REGEX);
    if (match) {
      const chartId = parseInt(match[1], 10);
      const chartLayoutKey = Object.keys(layout).find(
        key => layout[key]?.meta?.chartId === chartId,
      );
      if (chartLayoutKey && !chartKeys.includes(chartLayoutKey)) {
        chartKeys.push(chartLayoutKey);
      }
    }
  });

  // Anchor the scope at the dashboard root and let `excluded` carry the whole
  // selection. Deriving `rootPath` from the closest common ancestor is lossy on
  // dashboards with tabs: its depth was decided by the shallowest checked
  // chart, so unchecking a single chart could move the anchor from ROOT down to
  // the tab level. Every tab holding no checked chart then fell out of
  // `rootPath`, and its charts never reached `excluded` either (that loop only
  // visited charts whose parent is in `rootPath`), so they left the scope
  // unreported and the filter bar showed the filter as out of scope on tabs the
  // user never edited.
  const checkedChartIds = new Set(
    chartKeys
      .filter(item => layout[item]?.type === CHART_TYPE)
      .map(item => layout[item]?.meta?.chartId as number),
  );

  const rootPath = [DASHBOARD_ROOT_ID];
  const excluded = Object.values(layout)
    .filter(
      item =>
        item.type === CHART_TYPE &&
        item.meta?.chartId != null &&
        !checkedChartIds.has(item.meta.chartId as number),
    )
    .map(item => item.meta.chartId as number);

  return {
    rootPath: [...new Set(rootPath)],
    excluded,
  };
};

export const getDefaultScopeValue = (
  chartId?: number,
  initiallyExcludedCharts: number[] = [],
): NativeFilterScope => ({
  rootPath: [DASHBOARD_ROOT_ID],
  excluded: chartId
    ? [chartId, ...initiallyExcludedCharts]
    : initiallyExcludedCharts,
});
