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
import { max as d3Max } from 'd3-array';
import { HierarchyRectangularNode } from 'd3-hierarchy';
import { IcicleEventNode } from '../../types/IcicleEventNode';

export function findDepth(node: IcicleEventNode, depth: number = 0): number {
  if (!node.children) {
    return depth;
  }

  const maxDepth = d3Max(node.children.map(child => findDepth(child, depth + 1)));

  return maxDepth || depth;
}

export function hierarchySort(
  a: HierarchyRectangularNode<IcicleEventNode>,
  b: HierarchyRectangularNode<IcicleEventNode>,
): number {
  if (a && a.value && b && b.value) {
    return b.value - a.value || b.height - a.height;
  }

  return 0;
}
