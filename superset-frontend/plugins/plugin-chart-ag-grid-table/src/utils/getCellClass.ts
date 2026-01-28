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

import { CellClassParams } from '@superset-ui/core/components/ThemedAgGridReact';
import { InputColumn } from '../types';

type GetCellClassParams = CellClassParams & {
  col: InputColumn;
  emitCrossFilters: boolean | undefined;
};

const getCellClass = (params: GetCellClassParams) => {
  const { col, emitCrossFilters } = params;
  const isActiveFilterValue = params?.context?.isActiveFilterValue;
  let className = '';
  if (emitCrossFilters) {
    if (!col?.isMetric) {
      className += ' dt-is-filter';
    }
    if (isActiveFilterValue?.(col?.key, params?.value)) {
      className += ' dt-is-active-filter';
    }
    if (col?.config?.truncateLongCells) {
      className += ' dt-truncate-cell';
    }
  }
  return className;
};

export default getCellClass;
