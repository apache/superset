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
import { NEW_COMPONENTS_SOURCE_ID } from './constants';
import findParentId from './findParentId';
import getDetailedComponentWidth from './getDetailedComponentWidth';
import newComponentFactory from './newComponentFactory';

export default function getComponentWidthFromDrop({
  dropResult,
  layout: components,
}) {
  const { source, destination, dragging } = dropResult;

  const isNewComponent = source.id === NEW_COMPONENTS_SOURCE_ID;
  const component = isNewComponent
    ? newComponentFactory(dragging.type)
    : components[dragging.id] || {};

  // moving a component within the same container shouldn't change its width
  if (source.id === destination.id) {
    return component.meta.width;
  }

  const {
    width: draggingWidth,
    minimumWidth: minDraggingWidth,
  } = getDetailedComponentWidth({
    component,
    components,
  });

  const {
    width: destinationWidth,
    occupiedWidth: draggingOccupiedWidth,
  } = getDetailedComponentWidth({
    id: destination.id,
    components,
  });

  let destinationCapacity = Number(destinationWidth - draggingOccupiedWidth);

  if (Number.isNaN(destinationCapacity)) {
    const {
      width: grandparentWidth,
      occupiedWidth: grandparentOccupiedWidth,
    } = getDetailedComponentWidth({
      id: findParentId({
        childId: destination.id,
        layout: components,
      }),
      components,
    });

    destinationCapacity = Number(grandparentWidth - grandparentOccupiedWidth);
  }

  if (
    Number.isNaN(destinationCapacity) ||
    Number.isNaN(Number(draggingWidth))
  ) {
    return draggingWidth;
  }
  if (destinationCapacity >= draggingWidth) {
    return draggingWidth;
  }
  if (destinationCapacity >= minDraggingWidth) {
    return destinationCapacity;
  }

  return -1;
}
