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
import { ComponentType, DashboardLayout, LayoutItem } from '../types';
import { NEW_COMPONENTS_SOURCE_ID } from './constants';
import findParentId from './findParentId';
import getDetailedComponentWidth from './getDetailedComponentWidth';
import newComponentFactory from './newComponentFactory';

type DropLocation = {
  id: string;
  index: number;
  type?: ComponentType;
};

type DropResult = {
  source: DropLocation;
  destination: DropLocation;
  dragging: {
    id: string;
    type: ComponentType;
  };
};

export default function getComponentWidthFromDrop({
  dropResult,
  layout: components,
}: {
  dropResult: DropResult;
  layout: DashboardLayout;
}): number | undefined {
  const { source, destination, dragging } = dropResult;

  const isNewComponent = source.id === NEW_COMPONENTS_SOURCE_ID;
  const component: LayoutItem | undefined = isNewComponent
    ? newComponentFactory(dragging.type)
    : components[dragging.id];

  if (!component) {
    return undefined;
  }

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
    (destinationWidth ?? 0) - (draggingOccupiedWidth ?? 0),
  );

  if (Number.isNaN(destinationCapacity)) {
    const parentId = findParentId({
      childId: destination.id,
      layout: components,
    });
    const { width: grandparentWidth, occupiedWidth: grandparentOccupiedWidth } =
      getDetailedComponentWidth({
        id: parentId ?? undefined,
        components,
      });

    destinationCapacity = Number(
      (grandparentWidth ?? 0) - (grandparentOccupiedWidth ?? 0),
    );
  }

  if (
    Number.isNaN(destinationCapacity) ||
    Number.isNaN(Number(draggingWidth))
  ) {
    return draggingWidth;
  }
  if (destinationCapacity >= (draggingWidth ?? 0)) {
    return draggingWidth;
  }
  if (destinationCapacity >= (minDraggingWidth ?? 0)) {
    return destinationCapacity;
  }

  return -1;
}
