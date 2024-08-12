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

import { Filter } from 'src/views/CRUD/types';
import { NavBarProps, MenuObjectProps } from 'src/types/bootstrapTypes';

export enum WelcomeTable {
  Charts = 'CHARTS',
  Dashboards = 'DASHBOARDS',
  Recents = 'RECENTS',
  SavedQueries = 'SAVED_QUERIES',
}

export type WelcomePageLastTab = 'examples' | 'all' | [string, Filter[]];

export interface ExtensionConfigs {
  ALLOWED_EXTENSIONS: Array<any>;
  CSV_EXTENSIONS: Array<any>;
  COLUMNAR_EXTENSIONS: Array<any>;
  EXCEL_EXTENSIONS: Array<any>;
  HAS_GSHEETS_INSTALLED: boolean;
}
export interface RightMenuProps {
  align: 'flex-start' | 'flex-end';
  settings: MenuObjectProps[];
  navbarRight: NavBarProps;
  isFrontendRoute: (path?: string) => boolean;
  environmentTag: {
    text: string;
    color: string;
  };
}

export enum GlobalMenuDataOptions {
  GoogleSheets = 'gsheets',
  DbConnection = 'dbconnection',
  DatasetCreation = 'datasetCreation',
  CSVUpload = 'csvUpload',
  ExcelUpload = 'excelUpload',
  ColumnarUpload = 'columnarUpload',
}
