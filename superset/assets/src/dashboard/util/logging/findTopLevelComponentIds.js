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
import { TAB_TYPE, DASHBOARD_GRID_TYPE } from '../componentTypes';
import { DASHBOARD_ROOT_ID } from '../constants';
import findNonTabChildChartIds from './findNonTabChildChartIds';

// This function traverses the layout to identify top grid + tab level components
// for which we track load times
function findTopLevelComponentIds(layout) {
  const topLevelNodes = [];

  function recurseFromNode({
    node,
    index = null,
    depth,
    parentType = null,
    parentId = null,
  }) {
    if (!node) return;

    let nextParentType = parentType;
    let nextParentId = parentId;
    let nextDepth = depth;
    if (node.type === TAB_TYPE || node.type === DASHBOARD_GRID_TYPE) {
      const chartIds = findNonTabChildChartIds({
        layout,
        id: node.id,
      });

      topLevelNodes.push({
        id: node.id,
        type: node.type,
        parent_type: parentType,
        parent_id: parentId,
        index,
        depth,
        slice_ids: chartIds,
      });

      nextParentId = node.id;
      nextParentType = node.type;
      nextDepth += 1;
    }
    if (node.children && node.children.length) {
      node.children.forEach((childId, childIndex) => {
        recurseFromNode({
          node: layout[childId],
          index: childIndex,
          parentType: nextParentType,
          parentId: nextParentId,
          depth: nextDepth,
        });
      });
    }
  }

  recurseFromNode({
    node: layout[DASHBOARD_ROOT_ID],
    depth: 0,
  });

  return topLevelNodes;
}

// This method is called frequently, so cache results
let cachedLayout;
let cachedTopLevelNodes;
export default function findTopLevelComponentIdsWithCache(layout) {
  if (layout === cachedLayout) {
    return cachedTopLevelNodes;
  }
  cachedLayout = layout;
  cachedTopLevelNodes = findTopLevelComponentIds(layout);

  return cachedTopLevelNodes;
}
