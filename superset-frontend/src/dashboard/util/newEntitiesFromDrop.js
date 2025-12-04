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

import { ROW_TYPE, TABS_TYPE, TAB_TYPE, ALERTS_TYPE, MARKDOWN_TYPE } from './componentTypes';

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
    // When an Alert component is dropped, automatically create a Tab with Alert Data table
    const tabsWrapper = newComponentFactory(TABS_TYPE);
    const tabChild = newComponentFactory(TAB_TYPE, { text: 'Alert Data' });
    const rowInTab = newComponentFactory(ROW_TYPE);
    
    // Create a Markdown component with a dummy alert data table
    const alertTableMarkdown = newComponentFactory(MARKDOWN_TYPE, {
      code: `## Alert Data Table

| Alert ID | Timestamp | Device | Event Type | Severity | Message | Status |
|----------|-----------|---------|------------|----------|---------|--------|
| ALT-001 | 2025-12-04 10:30:15 | TEMP-001 | Temperature | Error | Temperature exceeded 45°C | Active |
| ALT-002 | 2025-12-04 10:25:42 | DEVICE-005 | Connection | Warning | Device offline | Resolved |
| ALT-003 | 2025-12-04 10:20:18 | PRESS-012 | Pressure | Warning | Pressure at 98% threshold | Active |
| ALT-004 | 2025-12-04 09:45:33 | DEVICE-003 | Connection | Success | Connection restored | Resolved |
| ALT-005 | 2025-12-04 09:30:21 | SENSOR-002 | Battery | Error | Battery level at 15% | Active |
| ALT-006 | 2025-12-04 09:15:47 | HUM-008 | Humidity | Info | Humidity reading normal | Active |
| ALT-007 | 2025-12-04 09:00:12 | DEVICE-011 | Status | Success | Device health check passed | Resolved |
| ALT-008 | 2025-12-04 08:45:55 | TEMP-003 | Temperature | Warning | Temperature approaching limit | Active |

**Total Alerts:** 8  
**Active Alerts:** 5  
**Resolved Alerts:** 3

---

*This is dummy alert data. Real alerts will be populated from MQTT messages.*`,
      width: 12,
      height: 50,
    });
    
    // Set up the parent-child hierarchy
    tabsWrapper.parents = (dropEntity.parents || []).concat(dropEntity.id);
    tabChild.parents = tabsWrapper.parents.concat(tabsWrapper.id);
    rowInTab.parents = tabChild.parents.concat(tabChild.id);
    alertTableMarkdown.parents = rowInTab.parents.concat(rowInTab.id);
    
    // Link children
    tabsWrapper.children = [tabChild.id];
    tabChild.children = [rowInTab.id];
    rowInTab.children = [alertTableMarkdown.id];
    
    // Add all entities
    newEntities[tabsWrapper.id] = tabsWrapper;
    newEntities[tabChild.id] = tabChild;
    newEntities[rowInTab.id] = rowInTab;
    newEntities[alertTableMarkdown.id] = alertTableMarkdown;
    
    // Place both Alert component and Tabs side by side in a row
    const containerRow = newComponentFactory(ROW_TYPE);
    containerRow.parents = (dropEntity.parents || []).concat(dropEntity.id);
    containerRow.children = [newDropChild.id, tabsWrapper.id];
    newEntities[containerRow.id] = containerRow;
    
    // Update parents for the alert component
    newDropChild.parents = containerRow.parents.concat(containerRow.id);
    
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
