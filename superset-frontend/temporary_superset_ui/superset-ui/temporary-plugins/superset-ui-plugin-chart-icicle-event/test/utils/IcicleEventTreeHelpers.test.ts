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
import { HierarchyNode, HierarchyRectangularNode, hierarchy as d3Hierarchy } from 'd3-hierarchy';
import { IcicleEventNode } from '../../src/IcicleEventNode';
import {
  findDepth,
  hierarchySort,
  createPartitionAndLayout,
} from '../../src/utils/IcicleEventTreeHelpers';

const ROOT_NODE: IcicleEventNode = {
  id: 'root',
  event: 'root',
  name: 'Root',
  value: 1,
};

const NODE_A: IcicleEventNode = {
  id: 'a-0',
  event: 'a',
  name: 'A',
  value: 1,
};

const NODE_B: IcicleEventNode = {
  id: 'b-0',
  event: 'b',
  name: 'B',
  value: 2,
};

const BALANCED_TREE: IcicleEventNode = {
  id: 'root',
  event: 'root',
  name: 'Root',
  value: 3,
  children: [NODE_A, NODE_B],
};

const UNBALANCED_TREE: IcicleEventNode = {
  id: 'root',
  event: 'root',
  name: 'Root',
  value: 2,
  children: [
    {
      id: 'a-1',
      event: 'a',
      name: 'A',
      value: 2,
      children: [NODE_B],
    },
  ],
};

describe('findDepth', () => {
  it('finds depth of tree with root node', () => {
    expect(findDepth(ROOT_NODE)).toBe(0);
  });

  it('finds depth of a balanced tree', () => {
    expect(findDepth(BALANCED_TREE)).toBe(1);
  });

  it('finds depth of an unbalanced tree', () => {
    expect(findDepth(UNBALANCED_TREE)).toBe(2);
  });
});

describe('hierarchySort', () => {
  it('sorts D3 hierarchy nodes correctly', () => {
    const root: HierarchyNode<IcicleEventNode> = d3Hierarchy(BALANCED_TREE).sort(hierarchySort);
    expect(root.children).toHaveLength(2);
    expect(root.children![0].data.id).toBe('b-0');
  });
});

describe('createPartitionAndLayout', () => {
  it('creates a D3 partition and returns the Hierarchy Rectangular Node correctly', () => {
    const root: HierarchyRectangularNode<IcicleEventNode> = createPartitionAndLayout(
      BALANCED_TREE,
      100,
      100,
    );
    expect(root).toHaveProperty('x0', 0);
    expect(root).toHaveProperty('y0', 0);
    expect(root).toHaveProperty('x1', 100);
    expect(root).toHaveProperty('y1', 50);

    expect(root.children).toHaveLength(2);

    const child = root.children![0];
    expect(child).toHaveProperty('x0', 0);
    expect(child).toHaveProperty('y0', 50);
    expect(child).toHaveProperty('x1');
    // 2/3 since NODE_B has a value of 2 & sibling has value of 1
    expect(child.x1).toBeCloseTo(100 * (2 / 3), 5);
    expect(child).toHaveProperty('y1', 100);
  });
});
