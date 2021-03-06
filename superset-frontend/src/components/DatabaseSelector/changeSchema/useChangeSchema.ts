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

import React, { useEffect, useRef } from 'react';

import { OnSelectChange } from '../onSelectChange';
import { factoryChangeSchema } from './factoryChangeSchema';

export const useChangeSchema = ({
  setCurrentSchema,
  onSchemaChange,
  getTableList,
  onSelectChange,
}: {
  setCurrentSchema: (schema: string | undefined) => void;
  onSchemaChange?: (arg0?: any) => {};
  getTableList?: (dbId: number, schema: string, force: boolean) => {};
  onSelectChange: React.MutableRefObject<OnSelectChange>;
}) => {
  const changeSchema = useRef(
    factoryChangeSchema({
      setCurrentSchema,
      onSchemaChange,
      getTableList,
      onSelectChange,
    }),
  );
  useEffect(() => {
    changeSchema.current = factoryChangeSchema({
      setCurrentSchema,
      onSchemaChange,
      getTableList,
      onSelectChange,
    });
  }, [getTableList, onSchemaChange, setCurrentSchema, onSelectChange]);

  return changeSchema;
};
