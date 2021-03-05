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
import { FetchSchemas } from '../fetchSchemas';
import { OnSelectChange } from '../onSelectChange';

export type ChangeDataBase = (db?: { id?: number }, force?: boolean) => void;

export const factoryChangeDataBase = ({
  fetchSchemas,
  onSelectChange,
  setSchemaOptions,
  onSchemaChange,
  onDbChange,
}: {
  fetchSchemas: React.MutableRefObject<FetchSchemas>;
  onSelectChange: React.MutableRefObject<OnSelectChange>;
  setSchemaOptions: (options: any[]) => void;
  onSchemaChange?: (arg0?: any) => {};
  onDbChange?: (db: any) => void;
}): ChangeDataBase => (db, force = false) => {
  const dbId = db?.id || null;
  setSchemaOptions([]);
  if (onSchemaChange) {
    onSchemaChange(null);
  }
  if (onDbChange) {
    onDbChange(db);
  }
  fetchSchemas.current({ databaseId: dbId, forceRefresh: force });
  onSelectChange.current({ dbId, schema: undefined });
};
