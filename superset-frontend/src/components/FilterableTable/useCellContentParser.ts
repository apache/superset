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
import { useCallback, useMemo } from 'react';

export type CellDataType = string | number | null;

export const NULL_STRING = 'NULL';

type Params = {
  columnKeys: string[];
  expandedColumns?: string[];
};

export function useCellContentParser({ columnKeys, expandedColumns }: Params) {
  // columns that have complex type and were expanded into sub columns
  const complexColumns = useMemo<Record<string, boolean>>(
    () =>
      columnKeys.reduce(
        (obj, key) => ({
          ...obj,
          [key]: expandedColumns?.some(name => name.startsWith(`${key}.`)),
        }),
        {},
      ),
    [expandedColumns, columnKeys],
  );

  return useCallback(
    ({
      cellData,
      columnKey,
    }: {
      cellData: CellDataType;
      columnKey: string;
    }) => {
      if (cellData === null) {
        return NULL_STRING;
      }
      const content = String(cellData);
      const firstCharacter = content.substring(0, 1);
      let truncated;
      if (firstCharacter === '[') {
        truncated = '[…]';
      } else if (firstCharacter === '{') {
        truncated = '{…}';
      } else {
        truncated = '';
      }
      return complexColumns[columnKey] ? truncated : content;
    },
    [complexColumns],
  );
}
