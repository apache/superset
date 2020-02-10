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
export function reorder(list, startIndex, endIndex) {
  const result = [...list];
  const [removed] = result.splice(startIndex, 1);
  result.splice(endIndex, 0, removed);

  return result;
}

export default function reorderItem({ entitiesMap, source, destination }) {
  const current = [...entitiesMap[source.id].children];
  const next = [...entitiesMap[destination.id].children];
  const target = current[source.index];

  // moving to same list
  if (source.id === destination.id) {
    const reordered = reorder(current, source.index, destination.index);

    const result = {
      ...entitiesMap,
      [source.id]: {
        ...entitiesMap[source.id],
        children: reordered,
      },
    };

    return result;
  }

  // moving to different list
  current.splice(source.index, 1); // remove from original
  next.splice(destination.index, 0, target); // insert into next

  const result = {
    ...entitiesMap,
    [source.id]: {
      ...entitiesMap[source.id],
      children: current,
    },
    [destination.id]: {
      ...entitiesMap[destination.id],
      children: next,
    },
  };

  return result;
}
