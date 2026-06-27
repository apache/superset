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
import type { dashboardComponents as dashboardComponentsApi } from '@apache-superset/core';
import { Icons } from '@superset-ui/core/components';
import { EXTENSION_TYPE } from '../../../util/componentTypes';
import { NEW_EXTENSION_ID } from '../../../util/constants';
import DraggableNewComponent from './DraggableNewComponent';

type Definition = dashboardComponentsApi.DashboardComponentDefinition;

/**
 * Palette drag source for an Extensions-contributed dashboard component. Drops a
 * new EXTENSION_TYPE instance whose `meta.extensionComponentId` selects the
 * contributed component, seeded with the definition's `defaultMeta`.
 */
export default function NewExtensionComponent({
  definition,
}: {
  definition: Definition;
}) {
  const IconComponent =
    (definition.icon &&
      (Icons as Record<string, (typeof Icons)[keyof typeof Icons]>)[
        definition.icon
      ]) ||
    Icons.AppstoreOutlined;

  return (
    <DraggableNewComponent
      id={`${NEW_EXTENSION_ID}-${definition.id}`}
      type={EXTENSION_TYPE}
      label={definition.name}
      IconComponent={IconComponent}
      meta={{ extensionComponentId: definition.id, ...definition.defaultMeta }}
    />
  );
}
