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
function findParentId({ childId, layout = {} }) {
  let parentId = null;

  const ids = Object.keys(layout);
  for (let i = 0; i <= ids.length - 1; i += 1) {
    const id = ids[i];
    const component = layout[id] || {};
    if (
      id !== childId &&
      component.children &&
      component.children.includes(childId)
    ) {
      parentId = id;
      break;
    }
  }

  return parentId;
}

const cache = {};
export default function findParentIdWithCache({ childId, layout = {} }) {
  if (cache[childId]) {
    const lastParent = layout[cache[childId]] || {};
    if (lastParent.children && lastParent.children.includes(childId)) {
      return lastParent.id;
    }
  }
  cache[childId] = findParentId({ childId, layout });
  return cache[childId];
}
