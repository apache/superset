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
import React from 'react';
import { t } from '@superset-ui/core';
import {
  CHART_TYPE,
  MARKDOWN_TYPE,
  TAB_TYPE,
} from 'src/dashboard/util/componentTypes';
import Icons from 'src/components/Icons';
import { Radio } from 'src/components/Radio';
import { ChartLayoutMeta, DashboardLayout } from 'src/dashboard/types';
import { DataNode } from 'antd/lib/tree';
import { DASHBOARD_ROOT_ID } from 'src/dashboard/util/constants';

export interface TreeNode extends DataNode {
  key: string;
  parent?: TreeNode;
  children?: TreeNode[];
}

// it's safer to add `undefined` because sometimes keys may not exists
export type TreeNodes = Record<string, TreeNode | undefined>;

/**
 * Build tab selection tree data for Antd <Tree /> component
 */
export function buildAntdTreeChildren({
  dashboardLayout,
  selectedTabs,
  nodeId,
}: {
  dashboardLayout: DashboardLayout;
  selectedTabs: string[];
  nodeId: string;
}) {
  const layoutNode = dashboardLayout[nodeId];
  if (!layoutNode?.children?.length) {
    return [];
  }
  const nodes: TreeNode[] = [];

  layoutNode.children.forEach((childId: string) => {
    const childNode = dashboardLayout[childId];
    switch (childNode.type) {
      // Tab content with children
      case TAB_TYPE:
        if (childNode.children.length) {
          const childTreeNodes = buildAntdTreeChildren({
            dashboardLayout,
            selectedTabs,
            nodeId: childId,
          });
          nodes.push({
            key: childId,
            title: childNode.meta.text || t('<Untitled tab>'),
            isLeaf: false,
            checkable: false,
            selectable: true,
            icon: <Radio checked={selectedTabs.includes(childId)} />,
            children: childTreeNodes,
          });
        }
        break;
      // Leaf nodes
      case CHART_TYPE:
      case MARKDOWN_TYPE:
        nodes.push({
          key: childId,
          title:
            childNode.type === CHART_TYPE
              ? (childNode.meta as ChartLayoutMeta).sliceName
              : t('<Markdown content>'),
          isLeaf: true,
          checkable: false,
          selectable: false,
          icon: <Icons.BarChartOutlined iconSize="m" iconColor="gray" />,
        });
        break;
      // Layout wrappers: TABS_TYPE | ROW_TYPE | COLUMN_TYPE
      default:
        nodes.splice(
          0,
          0,
          ...buildAntdTreeChildren({
            dashboardLayout,
            selectedTabs,
            nodeId: childId,
          }),
        );
    }
  });
  return nodes;
}

export function indexTreeNodes(
  nodes: TreeNode[],
  parentNode?: TreeNode,
  nodesIndex: TreeNodes = {},
) {
  const parent = parentNode || {
    key: DASHBOARD_ROOT_ID,
    children: nodes,
  };
  nodes.forEach(node => {
    // eslint-disable-next-line no-param-reassign
    node.parent = parent;
    if (node.children) {
      indexTreeNodes(node.children, node, nodesIndex);
    } else {
      // eslint-disable-next-line no-param-reassign
      nodesIndex[node.key] = node;
    }
  });
  // eslint-disable-next-line no-param-reassign
  nodesIndex[parent.key] = parent;
  return nodesIndex;
}

function getOffsprings(node: TreeNode, exclude?: string): string[] {
  return (
    node?.children?.flatMap(child =>
      child.key === exclude ? [] : [child.key].concat(getOffsprings(child)),
    ) || []
  );
}

function getSiblingTabs(tree: TreeNodes, tabId: string) {
  const parent = tree[tabId]?.parent;
  if (parent) {
    return getOffsprings(parent, tabId);
  }
  return [];
}

/**
 * Get first tab of offsprint tabs
 */
function getFirstChildTabs(tree: TreeNodes, tabId: string): string[] {
  const firstTab = tree[tabId]?.children?.find(node => node.selectable);
  if (firstTab) {
    return [firstTab.key, ...getFirstChildTabs(tree, firstTab.key)];
  }
  return [];
}

/**
 * Process mutually exclusive tab selection (i.e. select only one tab at a level)
 * and auto expand when necessary.
 */
export function changeTabSelection({
  treeNodes: tree,
  selectedTabs,
  expandedTabs,
  newSelectedTabs,
}: {
  treeNodes: TreeNodes;
  selectedTabs: string[];
  expandedTabs: string[];
  newSelectedTabs: string[];
}) {
  const toSelect = new Set(newSelectedTabs);
  const toExpand = new Set(expandedTabs);

  newSelectedTabs.forEach(nodeId => {
    // newly added tab
    if (!selectedTabs.includes(nodeId)) {
      // sibling tabs, including children tabs in siblings
      const siblings = getSiblingTabs(tree, nodeId);
      // remove siblings from selection
      siblings.forEach(sibling => {
        toSelect.delete(sibling);
        toExpand.delete(sibling);
      });
      // select children
      getFirstChildTabs(tree, nodeId).forEach(child => {
        toSelect.add(child);
        toExpand.add(child);
      });
      // always expand self
      toExpand.add(nodeId);
    }
  });

  return {
    selected: [...toSelect],
    expanded: [...toExpand],
  };
}
