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
import { ReactNode } from 'react';
import cx from 'classnames';
import { styled } from '@apache-superset/core/ui';
import { Icons } from '@superset-ui/core/components/Icons';
import { CHART_TYPE } from 'src/dashboard/util/componentTypes';

export interface FilterScopeTreeNode {
  value: string | number;
  label: string | ReactNode;
  type?: string;
  children?: FilterScopeTreeNode[];
}

interface TraverseParams {
  currentNode: FilterScopeTreeNode;
  selectedChartId?: number | null;
}

interface RenderFilterScopeTreeNodesParams {
  nodes: FilterScopeTreeNode[] | null;
  selectedChartId?: number | null;
}

const ChartIcon = styled(Icons.BarChartOutlined)`
  ${({ theme }) => `
    position: relative;
    top: ${theme.sizeUnit - 1}px;
    color: ${theme.colorPrimary};
    margin-right: ${theme.sizeUnit * 2}px;
  `}
`;

function traverse({
  currentNode,
  selectedChartId,
}: TraverseParams): FilterScopeTreeNode {
  const { label, value, type, children } = currentNode;
  if (children && children.length) {
    const updatedChildren = children.map(child =>
      traverse({ currentNode: child, selectedChartId }),
    );
    return {
      ...currentNode,
      label: (
        <span
          className={cx(`filter-scope-type ${type?.toLowerCase()}`, {
            'selected-filter': selectedChartId === value,
          })}
        >
          {type === CHART_TYPE && <ChartIcon />}
          {label}
        </span>
      ),
      children: updatedChildren,
    };
  }
  return {
    ...currentNode,
    label: (
      <span
        className={cx(`filter-scope-type ${type?.toLowerCase()}`, {
          'selected-filter': selectedChartId === value,
        })}
      >
        {label}
      </span>
    ),
  };
}

export default function renderFilterScopeTreeNodes({
  nodes,
  selectedChartId,
}: RenderFilterScopeTreeNodesParams): FilterScopeTreeNode[] {
  if (!nodes) {
    return [];
  }

  return nodes.map(node => traverse({ currentNode: node, selectedChartId }));
}
