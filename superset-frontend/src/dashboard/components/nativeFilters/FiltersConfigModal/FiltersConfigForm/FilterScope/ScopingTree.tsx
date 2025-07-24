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

import { FC, useMemo, useState, memo } from 'react';
import { NativeFilterScope, styled, css } from '@superset-ui/core';
import Tree from '@superset-ui/core/components/Tree';
import { DASHBOARD_ROOT_ID } from 'src/dashboard/util/constants';
import { Tooltip } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import { Layout } from 'src/dashboard/types';
import { useFilterScopeTree } from './state';
import { findFilterScope, getTreeCheckedItems } from './utils';

const StyledTree = styled(Tree)`
  .ant-tree-title {
    display: flex;
    align-items: center;
  }
`;

type ScopingTreeProps = {
  forceUpdate: Function;
  updateFormValues: (values: any) => void;
  formScope?: NativeFilterScope;
  initialScope: NativeFilterScope;
  chartId?: number;
  initiallyExcludedCharts?: number[];
  title?: string;
};

const buildTreeLeafTitle = (
  label: string,
  hasTooltip: boolean,
  tooltipTitle?: string,
  isDeckMultiChart?: boolean,
) => {
  let title = <span>{label}</span>;

  if (isDeckMultiChart) {
    title = (
      <span
        css={css`
          display: inline-flex;
          align-items: center;
        `}
      >
        <Icons.CheckSquareOutlined
          iconSize="l"
          css={css`
            margin-right: 4px;
          `}
        />
        {label}
      </span>
    );
  }

  if (hasTooltip) {
    title = (
      <>
        {title}&nbsp;
        <Tooltip title={tooltipTitle}>
          <Icons.InfoCircleOutlined iconSize="m" />
        </Tooltip>
      </>
    );
  }
  return title;
};

const separateKeys = (
  checkedKeys: string[],
): { layerKeys: string[]; nonLayerKeys: string[] } => {
  const layerKeys = checkedKeys.filter(key => key.includes('-layer-'));
  const nonLayerKeys = checkedKeys.filter(key => !key.includes('-layer-'));
  return { layerKeys, nonLayerKeys };
};

const extractParentChartIds = (layerKeys: string[]): Set<number> => {
  const LAYER_KEY_REGEX = /^chart-(\d+)-layer-\d+$/;
  const parentChartIds = new Set<number>();

  layerKeys.forEach(layerKey => {
    const match = layerKey.match(LAYER_KEY_REGEX);
    if (match) {
      const chartId = parseInt(match[1], 10);
      parentChartIds.add(chartId);
    }
  });
  return parentChartIds;
};

const updateScopeWithParentCharts = (
  scope: NativeFilterScope,
  parentChartIds: Set<number>,
  nonLayerKeys: string[],
  layout: Layout,
): NativeFilterScope => {
  const updatedScope = { ...scope };
  parentChartIds.forEach(chartId => {
    const chartLayoutKey = Object.keys(layout).find(
      key => layout[key]?.meta?.chartId === chartId,
    );
    if (chartLayoutKey && layout[chartLayoutKey]) {
      const tempScope = findFilterScope(
        [...nonLayerKeys, chartLayoutKey],
        layout,
      );
      updatedScope.rootPath = tempScope.rootPath;
      updatedScope.excluded = tempScope.excluded;
    }
  });
  return updatedScope;
};

const createFormValues = (
  scope: NativeFilterScope,
  layerKeys: string[],
  chartId?: number,
): { scope: NativeFilterScope & { selectedLayers?: string[] } } => {
  const finalScope = { ...scope };
  if (chartId !== undefined) {
    finalScope.excluded = [...new Set([...finalScope.excluded, chartId])];
  }
  return {
    scope:
      layerKeys.length > 0
        ? { ...finalScope, selectedLayers: layerKeys }
        : finalScope,
  };
};

const ScopingTree: FC<ScopingTreeProps> = ({
  formScope,
  initialScope,
  forceUpdate,
  updateFormValues,
  chartId,
  initiallyExcludedCharts = [],
  title,
}) => {
  const [expandedKeys, setExpandedKeys] = useState<string[]>([
    DASHBOARD_ROOT_ID,
  ]);

  const { treeData, layout } = useFilterScopeTree(
    chartId,
    initiallyExcludedCharts,
    buildTreeLeafTitle,
    title,
  );

  const [autoExpandParent, setAutoExpandParent] = useState<boolean>(true);

  const handleExpand = (expandedKeys: string[]) => {
    setExpandedKeys(expandedKeys);
    setAutoExpandParent(false);
  };

  const handleCheck = (checkedKeys: string[]) => {
    forceUpdate();
    const { layerKeys, nonLayerKeys } = separateKeys(checkedKeys);
    const scope = findFilterScope(nonLayerKeys, layout);
    const parentChartIds = extractParentChartIds(layerKeys);
    const updatedScope = updateScopeWithParentCharts(
      scope,
      parentChartIds,
      nonLayerKeys,
      layout,
    );
    updateFormValues(createFormValues(updatedScope, layerKeys, chartId));
  };

  const checkedKeys = useMemo(
    () =>
      getTreeCheckedItems(
        { ...(formScope || initialScope) },
        layout,
        ((formScope || initialScope) as any)?.selectedLayers,
      ),
    [formScope, initialScope, layout],
  );

  return (
    <StyledTree
      checkable
      selectable={false}
      onExpand={handleExpand}
      expandedKeys={expandedKeys}
      autoExpandParent={autoExpandParent}
      onCheck={handleCheck}
      checkedKeys={checkedKeys}
      treeData={treeData}
    />
  );
};

export default memo(ScopingTree);
