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
import { MinusCircleOutlined, PlusCircleOutlined } from '@ant-design/icons';
import { DataColumnMeta } from '../../../types';

export interface GroupingHeadersProps {
  groupHeaderColumns: Record<string, number[]>;
  filteredColumnsMeta: DataColumnMeta[];
  columnsMeta: DataColumnMeta[];
  hideComparisonKeys: string[];
  onHideComparisonKeysChange: (keys: string[]) => void;
}

export default function GroupingHeaders({
  groupHeaderColumns,
  filteredColumnsMeta,
  columnsMeta,
  hideComparisonKeys,
  onHideComparisonKeysChange,
}: GroupingHeadersProps) {
  const headers: any = [];
  let currentColumnIndex = 0;

  Object.entries(groupHeaderColumns || {}).forEach(([key, value]) => {
    const startPosition = value[0];
    const colSpan = value.length;
    const firstColumnInGroup = filteredColumnsMeta[startPosition];
    const originalLabel = firstColumnInGroup
      ? columnsMeta.find(col => col.key === firstColumnInGroup.key)
          ?.originalLabel || key
      : key;

    for (let i = currentColumnIndex; i < startPosition; i += 1) {
      headers.push(<th key={`placeholder-${i}`} aria-label={`Header-${i}`} />);
    }

    headers.push(
      <th key={`header-${key}`} colSpan={colSpan}>
        {originalLabel}
        <span className="toggle-icon">
          {hideComparisonKeys.includes(key) ? (
            <PlusCircleOutlined
              onClick={() =>
                onHideComparisonKeysChange(
                  hideComparisonKeys.filter(k => k !== key),
                )
              }
            />
          ) : (
            <MinusCircleOutlined
              onClick={() =>
                onHideComparisonKeysChange([...hideComparisonKeys, key])
              }
            />
          )}
        </span>
      </th>,
    );

    currentColumnIndex = startPosition + colSpan;
  });

  return <tr className="grouping-headers">{headers}</tr>;
}
