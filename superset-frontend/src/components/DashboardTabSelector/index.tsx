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
import React, { useState, useMemo, ReactNode } from 'react';
import { t, useTheme } from '@superset-ui/core';
import { Tree } from 'src/components';
import { DASHBOARD_ROOT_ID } from 'src/dashboard/util/constants';
import getEmptyLayout from 'src/dashboard/util/getEmptyLayout';
import Loading from 'src/components/Loading';
import { useDashboard } from 'src/hooks/apiResources';
import Alert from 'src/components/Alert';
import { TAB_TYPE } from 'src/dashboard/util/componentTypes';
import { DashboardLayout, Dashboard } from 'src/dashboard/types';
import {
  buildAntdTreeChildren,
  TreeNodes,
  changeTabSelection,
  indexTreeNodes,
} from './utils';

export type DashboardTabSelectorProps = {
  dashboardId: number | string;
  /**
   * Title shown when the dashboard has tabs to select from.
   */
  title?:
    | ReactNode
    | ((props: { dashboard?: Dashboard; hasTabs?: boolean }) => ReactNode);
  /**
   * List of the ids of selected tabs in the position data.
   */
  selectedTabs?: string[];
  /**
   * Event triggered when tab selection changes.
   */
  onChange: (selectedTabs: string[]) => void;
  /**
   * Max height of the tree selector.
   */
  maxHeight?: number | string;
  showLoading?: boolean;
  showTablessTree?: boolean;
};

/**
 * Select dashboard tabs from a custom tree view. This component will handle:
 *   - Fetch dashboard layout metadata
 *   - Render nested tabs as tree
 *   - Render tabs as radio buttons where users can only select one tab per level
 *   - Auto-fold unselected tabs
 * This is a bind components where values are only updated by selectedTabs
 */
export default function DashboardTabSelector({
  title,
  dashboardId,
  selectedTabs = [],
  onChange,
  maxHeight = '30vh',
  showLoading = true,
  showTablessTree = true,
}: DashboardTabSelectorProps) {
  const theme = useTheme();
  const { result: dashboard, error } = useDashboard(dashboardId);
  const [expandedTabs, setExpandedTabs] = useState(selectedTabs);
  const { position_data: positionData } = dashboard || {};
  const { treeData, treeNodes } = useMemo(() => {
    const dashboardLayout =
      positionData && DASHBOARD_ROOT_ID in positionData
        ? positionData
        : (getEmptyLayout() as unknown as DashboardLayout);
    const treeData = buildAntdTreeChildren({
      dashboardLayout,
      selectedTabs,
      nodeId: DASHBOARD_ROOT_ID,
    });
    const treeNodes: TreeNodes = indexTreeNodes(treeData);
    return {
      treeNodes,
      dashboardLayout,
      treeData,
    };
  }, [positionData, selectedTabs]);

  if (error) {
    return (
      <Alert type="error" message={t('Failed to load dashboard')}>
        {error}
      </Alert>
    );
  }
  if (!dashboard) {
    return showLoading ? <Loading /> : null;
  }

  const hasTabs = Object.values(positionData || {}).some(
    item => item?.type === TAB_TYPE,
  );
  const titleContent =
    typeof title === 'function' ? title({ dashboard, hasTabs }) : title;

  return (
    <div css={{ marginTop: theme.gridUnit * 2 }}>
      {titleContent}
      {(hasTabs || showTablessTree) && (
        <div css={{ maxHeight, overflow: 'auto' }}>
          <Tree
            treeData={treeData}
            selectable
            showIcon
            autoExpandParent
            multiple
            checkable={false}
            selectedKeys={selectedTabs}
            expandedKeys={expandedTabs}
            onExpand={expandedKeys => {
              setExpandedTabs(expandedKeys as string[]);
            }}
            onSelect={newSelectedTabs => {
              const { selected, expanded } = changeTabSelection({
                treeNodes,
                selectedTabs,
                expandedTabs,
                newSelectedTabs: newSelectedTabs as string[],
              });
              setExpandedTabs(expanded);
              onChange(selected);
            }}
          />
        </div>
      )}
    </div>
  );
}
