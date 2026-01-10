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
import CheckboxTree, { Node, OnCheckNode } from 'react-checkbox-tree';
import treeIcons from './treeIcons';
import renderFilterFieldTreeNodes, {
  FilterScopeTreeNode,
} from './renderFilterFieldTreeNodes';

interface FilterFieldTreeProps {
  activeKey?: string | null;
  nodes: FilterScopeTreeNode[];
  checked: (string | number)[];
  expanded: (string | number)[];
  onCheck: (checked: string[]) => void;
  onExpand: (expanded: string[]) => void;
  onClick: (node: OnCheckNode) => void;
}

export default function FilterFieldTree({
  activeKey = null,
  nodes = [],
  checked = [],
  expanded = [],
  onClick,
  onCheck,
  onExpand,
}: FilterFieldTreeProps) {
  return (
    <CheckboxTree
      showExpandAll
      showNodeIcon={false}
      expandOnClick
      nodes={renderFilterFieldTreeNodes({ nodes, activeKey }) as Node[]}
      checked={checked.map(String)}
      expanded={expanded.map(String)}
      onClick={onClick}
      onCheck={onCheck}
      onExpand={onExpand}
      icons={treeIcons}
    />
  );
}
