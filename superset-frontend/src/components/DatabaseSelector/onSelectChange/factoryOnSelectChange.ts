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

export type OnSelectChange = ({
  dbId,
  schema,
}: {
  dbId: number | null;
  schema?: string | null;
}) => void;

export const factoryOnSelectChange = ({
  setCurrentDbId,
  setCurrentSchema,
  onChange,
}: {
  setCurrentDbId: (dbId: number | null) => void;
  setCurrentSchema: (schema: string | undefined | null) => void;
  onChange?: ({
    dbId,
    schema,
  }: {
    dbId: number | null;
    schema?: string | null;
    tableName?: string;
  }) => void;
}): OnSelectChange => ({ dbId, schema }) => {
  setCurrentDbId(dbId);
  setCurrentSchema(schema);
  if (onChange) {
    onChange({ dbId, schema, tableName: undefined });
  }
};
