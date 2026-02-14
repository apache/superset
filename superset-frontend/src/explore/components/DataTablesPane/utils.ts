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
import { ensureIsArray, addLabelMapToVerboseMap } from '@superset-ui/core';
import { QueryResultInterface } from './types';

/**
 * Transforms the table data by applying formatting logic, such as renaming columns based on a label map.
 *
 * @param responseArray - An array of query result interfaces possibly containing a label_map.
 * @returns An array of query result interfaces with updated colnames and data.
 */
export const transformTableData = (
  responseArray: ReadonlyArray<
    QueryResultInterface & { label_map?: Record<string, string[]> }
  >,
): QueryResultInterface[] => {
  const transformedResponseArray = responseArray.map(response => {
    const labelMap = response.label_map || {};
    /**
     * Inverts the label map to create a verbose map.
     *
     * For example if labelMap is { "Sales": ["total_sales"], "Profit": ["total_profit"] },
     * the verboseMap will be { "total_sales": "Sales", "total_profit": "Profit" }
     */
    const verboseMap = Object.entries(labelMap)
      .filter(([_key, value]) => ensureIsArray(value).length === 1)
      .reduce(
        (acc, [key, value]) => ({
          ...acc,
          [ensureIsArray(value)[0]]: key,
        }),
        {},
      );

    const updatedVerboseMap = addLabelMapToVerboseMap(labelMap, verboseMap);

    return {
      ...response,
      // Updates the response's colnames and data using the verbose map.
      colnames: response.colnames.map(
        (colname: string) => updatedVerboseMap[colname] || colname,
      ),
      /**
       * Maps through each row of data and updates the keys using the verbose map.
       * For example, if a row is { "total_sales": 100, "total_profit": 20 },
       * it will be transformed to { "total_sales": 100, "total_profit": 20, "Sales": 100, "Profit": 20 }
       */
      data: response.data.map((row: any) =>
        Object.entries(row).reduce(
          (acc, [key, value]) => ({
            ...acc,
            [key]: value,
            [updatedVerboseMap[key] || key]: value,
          }),
          {},
        ),
      ),
    };
  });

  return transformedResponseArray as QueryResultInterface[];
};
