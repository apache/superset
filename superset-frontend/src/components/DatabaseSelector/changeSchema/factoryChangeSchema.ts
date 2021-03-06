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

import React from 'react';
import { OnSelectChange } from '../onSelectChange';

export type ChangeSchema = ({
  currentDbId,
  selectedSchema,
  force,
}: {
  currentDbId: number | null;
  selectedSchema: { value: string; label: string; title: string };
  force?: boolean;
}) => void;

export const factoryChangeSchema = ({
  onSelectChange,
  setCurrentSchema,
  onSchemaChange,
  getTableList,
}: {
  onSelectChange: React.MutableRefObject<OnSelectChange>;
  setCurrentSchema: (schema: string | null | undefined) => void;
  onSchemaChange?: (arg0?: any) => {};
  getTableList?: (
    dbId: number | null,
    schema: string | null,
    force: boolean,
  ) => {};
}): ChangeSchema => ({ currentDbId, selectedSchema, force }) => {
  /**
   * This validation already existed in this function, so I kept the validation and updated the types to support a possible null
   */
  const schema = selectedSchema?.value || null;
  if (onSchemaChange) {
    onSchemaChange(schema);
  }
  setCurrentSchema(schema);
  onSelectChange.current({ dbId: currentDbId, schema });
  if (getTableList) {
    getTableList(currentDbId, schema, !!force);
  }
};
