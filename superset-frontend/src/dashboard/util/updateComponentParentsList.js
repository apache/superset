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
import { logging } from '@superset-ui/core';

export default function updateComponentParentsList({
  currentComponent,
  layout = {},
}) {
  if (currentComponent && layout) {
    if (layout[currentComponent.id]) {
      const parentsList = Array.isArray(currentComponent.parents)
        ? currentComponent.parents.slice()
        : [];

      parentsList.push(currentComponent.id);

      if (Array.isArray(currentComponent.children)) {
        currentComponent.children.forEach(childId => {
          if (layout[childId]) {
            // eslint-disable-next-line no-param-reassign
            layout[childId] = {
              ...layout[childId],
              parents: parentsList,
            };
            updateComponentParentsList({
              currentComponent: layout[childId],
              layout,
            });
          } else {
            logging.warn(
              `The current layout does not contain a component with the id: ${childId}.  Skipping this component`,
            );
          }
        });
      }
    } else {
      logging.warn(
        `The current layout does not contain a component with the id: ${currentComponent?.id}.  Skipping this component`,
      );
    }
  }
}
