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
import { DefaultSortTypes } from 'react-table';
import { GenericDataType } from '@apache-superset/core/api/core';
import { DataColumnMeta } from '../../../types';

/**
 * Return sortType based on data type
 */
export function getSortTypeByDataType(
  dataType: GenericDataType,
): DefaultSortTypes {
  if (dataType === GenericDataType.Temporal) {
    return 'datetime';
  }
  if (dataType === GenericDataType.String) {
    return 'alphanumeric';
  }
  return 'basic';
}

/**
 * Get header columns for time comparison grouping
 */
export function getHeaderColumns(
  columnsMeta: DataColumnMeta[],
  comparisonLabels: string[],
  enableTimeComparison?: boolean,
): Record<string, number[]> {
  const resultMap: Record<string, number[]> = {};

  if (!enableTimeComparison) {
    return resultMap;
  }

  columnsMeta.forEach((element, index) => {
    if (comparisonLabels.includes(element.label)) {
      const keyPortion = element.key.substring(element.label.length);

      if (!resultMap[keyPortion]) {
        resultMap[keyPortion] = [index];
      } else {
        resultMap[keyPortion].push(index);
      }
    }
  });

  return resultMap;
}
