// DODO was here

import { Filter } from 'src/views/CRUD/types';
import { NavBarProps, MenuObjectProps } from 'src/types/bootstrapTypes';
import { HandlerFunction } from '@superset-ui/core';

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
interface RightMenuPropsDodoExtended {
  setConnectionError: HandlerFunction; // DODO added 47383817
}
export interface RightMenuProps extends RightMenuPropsDodoExtended {
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
