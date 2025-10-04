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
import type { ReactNode, DetailedHTMLProps, TdHTMLAttributes } from 'react';
import type { DatasetObject } from 'src/features/datasets/types';

export interface Datasource {
  type: string;
  id: number;
  uid: string;
}

export interface DatasourceModalProps {
  addSuccessToast: (msg: string) => void;
  addDangerToast: (msg: string) => void;
  datasource: DatasetObject;
  onChange: () => {};
  onDatasourceSave: (datasource: object, errors?: Array<any>) => {};
  onHide: () => {};
  show: boolean;
}

export interface ChangeDatasourceModalProps {
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
  onChange: (uid: string) => void;
  onDatasourceSave: (datasource: object, errors?: Array<any>) => {};
  onHide: () => void;
  show: boolean;
}

export interface CRUDCollectionProps {
  allowAddItem?: boolean;
  allowDeletes?: boolean;
  collection: Record<PropertyKey, any>[];
  columnLabels?: Record<PropertyKey, any>;
  columnLabelTooltips?: Record<PropertyKey, any>;
  emptyMessage?: ReactNode;
  expandFieldset?: ReactNode;
  extraButtons?: ReactNode;
  itemGenerator?: () => any;
  itemCellProps?: ((
    val: unknown,
    label: string,
    record: any,
  ) => DetailedHTMLProps<
    TdHTMLAttributes<HTMLTableCellElement>,
    HTMLTableCellElement
  >)[];
  itemRenderers?: ((
    val: unknown,
    onChange: () => void,
    label: string,
    record: any,
  ) => ReactNode)[];
  onChange?: (arg0: any) => void;
  tableColumns: any[];
  tableLayout?: 'fixed' | 'auto';
  sortColumns: string[];
  stickyHeader?: boolean;
}

export type Sort = number | string | boolean | any;

export enum SortOrder {
  Asc = 1,
  Desc = 2,
  Unsorted = 0,
}

export interface CRUDCollectionState {
  collection: Record<PropertyKey, any>;
  collectionArray: Record<PropertyKey, any>[];
  expandedColumns: Record<PropertyKey, any>;
  sortColumn: string;
  sort: SortOrder;
}
