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
import { ReactNode } from 'react';

import type { AgGridReactProps } from 'ag-grid-react';
import { GridSize } from './constants';

export type ColDef = {
  type: string;
  field: string;
};

export interface TableProps<RecordType> {
  /**
   * Data that will populate the each row and map to the column key.
   */
  data: RecordType[];
  /**
   * Table column definitions.
   */
  columns: {
    label: string;
    headerName?: string;
    width?: number;
    comparator?: (valueA: string | number, valueB: string | number) => number;
    render?: (value: any) => ReactNode;
  }[];

  size?: GridSize;

  externalFilter?: AgGridReactProps['doesExternalFilterPass'];

  height: number;

  columnReorderable?: boolean;

  sortable?: boolean;

  enableActions?: boolean;

  showRowNumber?: boolean;

  usePagination?: boolean;

  striped?: boolean;
}
