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
import { hierarchy } from 'd3-hierarchy';
import { init, PartitionDataNode, PartitionNode } from '../src/Partition';

// Mirrors the uneven-branching repro from #43727: category "B" has no
// sub_subcategory (terminates one level shallower than "A"), which used to
// be enough to throw off the shared "previous node" traversal heuristic.
function buildUnevenTree(): PartitionDataNode {
  return {
    name: 'Metric',
    val: 4,
    children: [
      {
        name: 'B',
        val: 2,
        children: [{ name: 'B1', val: 2 }],
      },
      {
        name: 'A',
        val: 2,
        children: [
          {
            name: 'A1',
            val: 2,
            children: [
              { name: 'A1a', val: 1 },
              { name: 'A1b', val: 1 },
            ],
          },
        ],
      },
    ],
  };
}

function buildInitializedNodes(data: PartitionDataNode): PartitionNode[] {
  const root = hierarchy<PartitionDataNode>(data) as unknown as PartitionNode;
  // Populate the weight/sum fields init() relies on, the same way
  // Icicle's drawVis does before calling init().
  root.eachAfter(n => {
    n.weight = n.data.val;
  });
  root.eachAfter(n => {
    n.sum = n.children ? n.children.reduce((a, v) => a + v.weight, 0) || 1 : 1;
  });

  return init(root);
}

test('keeps every node within its own parent band, even when a sibling branch terminates early', () => {
  const nodes = buildInitializedNodes(buildUnevenTree());

  nodes.forEach(n => {
    if (!n.parent) return;
    expect(n.x).toBeGreaterThanOrEqual(n.parent.x - 1e-9);
    expect(n.x + n.dx).toBeLessThanOrEqual(n.parent.x + n.parent.dx + 1e-9);
  });
});

test('positions descendants of the deeper branch relative to their true ancestors', () => {
  const nodes = buildInitializedNodes(buildUnevenTree());
  const byName = Object.fromEntries(nodes.map(n => [n.name, n]));

  // Before the fix, A1a/A1b were reset to x=0 (B's band) instead of being
  // positioned within A1's band, because the first node reached at depth 3
  // belonged to A -- the branch that kept going -- not to B, the first
  // branch visited in breadth-first order.
  expect(byName.A1a.x).toBeCloseTo(byName.A1.x);
  expect(byName.A1b.x).toBeCloseTo(byName.A1.x + byName.A1a.dx);
});
