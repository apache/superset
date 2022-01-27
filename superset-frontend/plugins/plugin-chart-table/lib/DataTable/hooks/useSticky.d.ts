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
import { ReactNode, ReactElement, ComponentPropsWithRef } from 'react';
import { Hooks } from 'react-table';
declare type ReactElementWithChildren<T extends keyof JSX.IntrinsicElements, C extends ReactNode = ReactNode> = ReactElement<ComponentPropsWithRef<T> & {
    children: C;
}, T>;
declare type Th = ReactElementWithChildren<'th'>;
declare type Td = ReactElementWithChildren<'td'>;
declare type TrWithTh = ReactElementWithChildren<'tr', Th[]>;
declare type TrWithTd = ReactElementWithChildren<'tr', Td[]>;
declare type Thead = ReactElementWithChildren<'thead', TrWithTh>;
declare type Tbody = ReactElementWithChildren<'tbody', TrWithTd>;
declare type Tfoot = ReactElementWithChildren<'tfoot', TrWithTd>;
declare type Col = ReactElementWithChildren<'col', null>;
declare type ColGroup = ReactElementWithChildren<'colgroup', Col>;
export declare type Table = ReactElementWithChildren<'table', (Thead | Tbody | Tfoot | ColGroup)[]>;
export declare type TableRenderer = () => Table;
export declare type GetTableSize = () => Partial<StickyState> | undefined;
export declare type SetStickyState = (size?: Partial<StickyState>) => void;
export declare enum ReducerActions {
    init = "init",
    setStickyState = "setStickyState"
}
export declare type ReducerAction<T extends string, P extends Record<string, unknown>> = P & {
    type: T;
};
export declare type ColumnWidths = number[];
export interface StickyState {
    width?: number;
    height?: number;
    realHeight?: number;
    bodyHeight?: number;
    tableHeight?: number;
    columnWidths?: ColumnWidths;
    hasHorizontalScroll?: boolean;
    hasVerticalScroll?: boolean;
    rendering?: boolean;
    setStickyState?: SetStickyState;
}
export interface UseStickyTableOptions {
    getTableSize?: GetTableSize;
}
export interface UseStickyInstanceProps {
    wrapStickyTable: (renderer: TableRenderer) => ReactNode;
    setStickyState: SetStickyState;
}
export declare type UseStickyState = {
    sticky: StickyState;
};
declare function useSticky<D extends object>(hooks: Hooks<D>): void;
declare namespace useSticky {
    var pluginName: string;
}
export default useSticky;
//# sourceMappingURL=useSticky.d.ts.map