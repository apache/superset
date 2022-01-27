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
import { ReactNode, HTMLProps, MutableRefObject } from 'react';
import { PluginHook, TableOptions } from 'react-table';
import { GlobalFilterProps } from './components/GlobalFilter';
import { SelectPageSizeProps, SizeOption } from './components/SelectPageSize';
export interface DataTableProps<D extends object> extends TableOptions<D> {
    tableClassName?: string;
    searchInput?: boolean | GlobalFilterProps<D>['searchInput'];
    selectPageSize?: boolean | SelectPageSizeProps['selectRenderer'];
    pageSizeOptions?: SizeOption[];
    maxPageItemCount?: number;
    hooks?: PluginHook<D>[];
    width?: string | number;
    height?: string | number;
    serverPagination?: boolean;
    onServerPaginationChange: (pageNumber: number, pageSize: number) => void;
    serverPaginationData: {
        pageSize?: number;
        currentPage?: number;
    };
    pageSize?: number;
    noResults?: string | ((filterString: string) => ReactNode);
    sticky?: boolean;
    rowCount: number;
    wrapperRef?: MutableRefObject<HTMLDivElement>;
}
export interface RenderHTMLCellProps extends HTMLProps<HTMLTableCellElement> {
    cellContent: ReactNode;
}
export default function DataTable<D extends object>({ tableClassName, columns, data, serverPaginationData, width: initialWidth, height: initialHeight, pageSize: initialPageSize, initialState: initialState_, pageSizeOptions, maxPageItemCount, sticky: doSticky, searchInput, onServerPaginationChange, rowCount, selectPageSize, noResults: noResultsText, hooks, serverPagination, wrapperRef: userWrapperRef, ...moreUseTableOptions }: DataTableProps<D>): JSX.Element;
//# sourceMappingURL=DataTable.d.ts.map