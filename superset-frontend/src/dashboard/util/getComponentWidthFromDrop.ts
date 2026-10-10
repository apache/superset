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
import { DashboardComponentMap } from '../types';
import { DropResult } from '../components/dnd/dragDroppableConfig';

interface GetComponentWidthFromDropParams {
  dropResult: DropResult;
  layout: DashboardComponentMap;
}

export default function getComponentWidthFromDrop({
  dropResult,
  layout: components,
}: GetComponentWidthFromDropParams): number | undefined {
  const { source, destination, dragging } = dropResult;
  if (!destination) return undefined;

  const isNewComponent = source.id === NEW_COMPONENTS_SOURCE_ID;
  const component = isNewComponent
    ? newComponentFactory(dragging.type)
    : components[dragging.id];

  // moving a component within the same container shouldn't change its width
  if (source.id === destination.id) {
    return component.meta?.width;
  }

  const { width: draggingWidth, minimumWidth: minDraggingWidth } =
    getDetailedComponentWidth({
      component,
      components,
    });

  const { width: destinationWidth, occupiedWidth: draggingOccupiedWidth } =
    getDetailedComponentWidth({
      id: destination.id,
      components,
    });

  let destinationCapacity = Number(
    (destinationWidth ?? NaN) - (draggingOccupiedWidth ?? NaN),
  );

  if (Number.isNaN(destinationCapacity)) {
    const { width: grandparentWidth, occupiedWidth: grandparentOccupiedWidth } =
      getDetailedComponentWidth({
        id: findParentId({
          childId: destination.id,
          layout: components,
        }),
        components,
      });

    destinationCapacity = Number(
      (grandparentWidth ?? NaN) - (grandparentOccupiedWidth ?? NaN),
    );
  }

  if (
    Number.isNaN(destinationCapacity) ||
    Number.isNaN(Number(draggingWidth))
  ) {
    return draggingWidth;
  }
  if (draggingWidth !== undefined && destinationCapacity >= draggingWidth) {
    return draggingWidth;
  }
  if (
    minDraggingWidth !== undefined &&
    destinationCapacity >= minDraggingWidth
  ) {
    return destinationCapacity;
  }

  return -1;
}
