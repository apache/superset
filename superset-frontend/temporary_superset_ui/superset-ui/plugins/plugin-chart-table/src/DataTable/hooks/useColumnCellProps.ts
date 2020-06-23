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
import { HTMLProps } from 'react';
import { Hooks, Cell, TableCellProps, ColumnInstance } from 'react-table';

export interface UseColumnCellPropsColumnOption<D extends object, V = unknown> {
  cellProps?: (
    cell: Cell<D, V>,
    props: Partial<TableCellProps>,
  ) => Partial<HTMLProps<HTMLTableDataCellElement>> | undefined;
}

/**
 * Configure cell props in column options.
 */
export default function useColumnCellProps<D extends object>(hooks: Hooks<D>) {
  hooks.getCellProps.push((props, { cell }) => {
    const column = cell.column as ColumnInstance<D>;
    return (column.cellProps && column.cellProps(cell, props)) || [];
  });
}
useColumnCellProps.pluginName = 'useColumnCellProps';
