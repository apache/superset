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
import FilterFieldItem from './FilterFieldItem';

export interface FilterScopeTreeNode {
  value: string | number;
  label: string | ReactNode;
  type?: string;
  children?: FilterScopeTreeNode[];
}

interface RenderFilterFieldTreeNodesParams {
  nodes: FilterScopeTreeNode[] | null;
  activeKey?: string | null;
}

export default function renderFilterFieldTreeNodes({
  nodes,
  activeKey,
}: RenderFilterFieldTreeNodesParams): FilterScopeTreeNode[] {
  if (!nodes || nodes.length === 0) {
    return [];
  }

  const root = nodes[0];
  const allFilterNodes = root.children || [];
  const children = allFilterNodes.map(node => ({
    ...node,
    children: (node.children || []).map(child => {
      const { label, value } = child;
      return {
        ...child,
        label: (
          <FilterFieldItem
            isSelected={value === activeKey}
            label={String(label)}
          />
        ),
      };
    }),
  }));

  return [
    {
      ...root,
      label: <span className="root">{root.label}</span>,
      children,
    },
  ];
}
