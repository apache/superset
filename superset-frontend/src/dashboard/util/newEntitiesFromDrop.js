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
import componentIsResizable from './componentIsResizable';
import shouldWrapChildInRow from './shouldWrapChildInRow';
import newComponentFactory from './newComponentFactory';
import getComponentWidthFromDrop from './getComponentWidthFromDrop';

import { ROW_TYPE, TABS_TYPE, TAB_TYPE, ALERTS_TYPE, ALERT_DATA_TABLE_TYPE } from './componentTypes';

export default function newEntitiesFromDrop({ dropResult, layout }) {
  const { dragging, destination } = dropResult;

  const dragType = dragging.type;
  const dropEntity = layout[destination.id];
  const dropType = dropEntity.type;
  let newDropChild = newComponentFactory(dragType, dragging.meta);
  newDropChild.parents = (dropEntity.parents || []).concat(dropEntity.id);

  if (componentIsResizable(dragging)) {
    newDropChild.meta.width = // don't set a 0 width
      getComponentWidthFromDrop({ dropResult, layout }) || undefined;
  }

  const wrapChildInRow = shouldWrapChildInRow({
    parentType: dropType,
    childType: dragType,
  });

  const newEntities = {
    [newDropChild.id]: newDropChild,
  };

  if (wrapChildInRow) {
    const rowWrapper = newComponentFactory(ROW_TYPE);
    rowWrapper.children = [newDropChild.id];
    rowWrapper.parents = (dropEntity.parents || []).concat(dropEntity.id);
    newEntities[rowWrapper.id] = rowWrapper;
    newDropChild.parents = rowWrapper.parents.concat(rowWrapper.id);
    newDropChild = rowWrapper;
  } else if (dragType === TABS_TYPE) {
    // create a new tab component
    const tabChild = newComponentFactory(TAB_TYPE);
    tabChild.parents = (dropEntity.parents || []).concat(dropEntity.id);
    newDropChild.children = [tabChild.id];
    newEntities[tabChild.id] = tabChild;
  } else if (dragType === ALERTS_TYPE) {
    // When an Alert component is dropped, automatically create a Tabs with Alert Data Table
    // Place both Alert component and Tabs side by side in a row
    console.log('[ALERT DROP] Creating tabs and alert data table for alert component');
    
    const containerRow = newComponentFactory(ROW_TYPE);
    const tabsWrapper = newComponentFactory(TABS_TYPE);
    const tabChild = newComponentFactory(TAB_TYPE, { text: 'Alert Data' });
    const alertDataTable = newComponentFactory(ALERT_DATA_TABLE_TYPE);
    
    console.log('[ALERT DROP] Created entities:', {
      containerRowId: containerRow.id,
      tabsWrapperId: tabsWrapper.id,
      tabChildId: tabChild.id,
      alertDataTableId: alertDataTable.id,
    });
    
    // Set up the parent-child hierarchy with correct parents
    const baseParents = (dropEntity.parents || []).concat(dropEntity.id);
    containerRow.parents = baseParents;
    newDropChild.parents = baseParents.concat(containerRow.id);
    tabsWrapper.parents = baseParents.concat(containerRow.id);
    tabChild.parents = tabsWrapper.parents.concat(tabsWrapper.id);
    alertDataTable.parents = tabChild.parents.concat(tabChild.id);
    
    // Link children
    containerRow.children = [newDropChild.id, tabsWrapper.id];
    tabsWrapper.children = [tabChild.id];
    tabChild.children = [alertDataTable.id];
    
    // Add all entities
    newEntities[containerRow.id] = containerRow;
    newEntities[tabsWrapper.id] = tabsWrapper;
    newEntities[tabChild.id] = tabChild;
    newEntities[alertDataTable.id] = alertDataTable;
    
    console.log('[ALERT DROP] Entities to be added:', {
      containerRow: containerRow,
      tabsWrapper: tabsWrapper,
      tabChild: tabChild,
      alertDataTable: alertDataTable,
    });
    
    // The container row is what gets added to the drop destination
    newDropChild = containerRow;
  }

  const nextDropChildren = [...dropEntity.children];
  nextDropChildren.splice(destination.index, 0, newDropChild.id);

  newEntities[destination.id] = {
    ...dropEntity,
    children: nextDropChildren,
  };

  return newEntities;
}
