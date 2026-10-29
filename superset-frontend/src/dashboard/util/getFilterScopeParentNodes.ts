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
interface FilterScopeTreeNode {
  value?: string | number;
  children?: FilterScopeTreeNode[];
}

export default function getFilterScopeParentNodes(
  nodes: FilterScopeTreeNode[] = [],
  depthLimit = -1,
): string[] {
  const parentNodes: string[] = [];
  const traverse = (
    currentNode: FilterScopeTreeNode | undefined,
    depth: number,
  ): void => {
    if (!currentNode) {
      return;
    }

    if (currentNode.children && (depthLimit === -1 || depth < depthLimit)) {
      if (currentNode.value !== undefined) {
        parentNodes.push(String(currentNode.value));
      }
      currentNode.children.forEach(child => traverse(child, depth + 1));
    }
  };

  if (nodes.length > 0) {
    nodes.forEach(node => {
      traverse(node, 0);
    });
  }

  return parentNodes;
}
