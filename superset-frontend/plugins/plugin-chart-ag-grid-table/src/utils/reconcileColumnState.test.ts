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
import {
  type ColDef,
  type ColumnState,
} from '@superset-ui/core/components/ThemedAgGridReact';
import reconcileColumnState, { getLeafColumnIds } from './reconcileColumnState';

test('getLeafColumnIds flattens grouped column defs in visual order', () => {
  const colDefs: ColDef[] = [
    { field: 'Manufacture_Date' },
    {
      headerName: 'Metrics',
      children: [
        { field: 'SUM(Sales_Amount)' },
        { field: 'SUM(Discount_Applied)' },
      ],
    } as ColDef,
    { field: 'SUM(Quantity_Sold)' },
  ];

  expect(getLeafColumnIds(colDefs)).toEqual([
    'Manufacture_Date',
    'SUM(Sales_Amount)',
    'SUM(Discount_Applied)',
    'SUM(Quantity_Sold)',
  ]);
});

test('preserves saved order when the current column set is unchanged', () => {
  const colDefs: ColDef[] = [
    { field: 'Transaction_Timestamp' },
    { field: 'SUM(Sales_Amount)' },
    { field: 'SUM(Discount_Applied)' },
  ];
  const savedColumnState: ColumnState[] = [
    { colId: 'SUM(Sales_Amount)' },
    { colId: 'Transaction_Timestamp' },
    { colId: 'SUM(Discount_Applied)' },
  ];

  expect(reconcileColumnState(savedColumnState, colDefs)).toEqual({
    applyOrder: true,
    columnState: savedColumnState,
  });
});

test('drops stale order when a dynamic group by swaps the dimension column', () => {
  const currentColDefs: ColDef[] = [
    { field: 'Manufacture_Date' },
    { field: 'SUM(Sales_Amount)' },
    { field: 'SUM(Discount_Applied)' },
    { field: 'SUM(Quantity_Sold)' },
  ];
  const savedColumnState: ColumnState[] = [
    { colId: 'Transaction_Timestamp' },
    { colId: 'SUM(Sales_Amount)' },
    { colId: 'SUM(Discount_Applied)' },
    { colId: 'SUM(Quantity_Sold)' },
  ];

  expect(reconcileColumnState(savedColumnState, currentColDefs)).toEqual({
    applyOrder: false,
    columnState: [
      { colId: 'SUM(Sales_Amount)' },
      { colId: 'SUM(Discount_Applied)' },
      { colId: 'SUM(Quantity_Sold)' },
    ],
  });
});
