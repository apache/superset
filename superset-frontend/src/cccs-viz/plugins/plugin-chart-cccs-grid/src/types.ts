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
import { QueryFormData, SetDataMaskHook, supersetTheme, TimeseriesDataRecord } from '@superset-ui/core';

export interface CccsGridStylesProps {
  height: number;
  width: number;
  headerFontSize?: keyof typeof supersetTheme.typography.sizes;
  boldText?: boolean;
}

interface CccsGridCustomizeProps {
  headerText: string;
  emitFilter: boolean;
  setDataMask: SetDataMaskHook;
  selectedValues: Record<number, string>;
  formData: CccsGridQueryFormData;
}

export type CccsGridQueryFormData = QueryFormData &
  CccsGridStylesProps &
  CccsGridCustomizeProps;

export type CccsGridProps = CccsGridStylesProps &
  CccsGridCustomizeProps & {
    data: TimeseriesDataRecord[];
    columnDefs: any;
    rowData: any;
    tooltipShowDelay: any;
    frameworkComponents: any;
    modules: any;
    defaultColDef: any;
    rowSelection: any;
    // add typing here for the props you pass in from transformProps.ts!
  };

export type EventHandlers = Record<string, { (props: any): void }>;
