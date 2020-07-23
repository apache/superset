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
export default function findTabIndexByComponentId({
  currentComponent,
  directPathToChild = [],
}) {
  if (
    !currentComponent ||
    directPathToChild.length === 0 ||
    directPathToChild.indexOf(currentComponent.id) === -1
  ) {
    return -1;
  }

  const currentComponentIdx = directPathToChild.findIndex(
    id => id === currentComponent.id,
  );
  const nextParentId = directPathToChild[currentComponentIdx + 1];
  if (currentComponent.children.indexOf(nextParentId) >= 0) {
    return currentComponent.children.findIndex(
      childId => childId === nextParentId,
    );
  }
  return -1;
}
