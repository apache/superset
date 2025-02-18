// DODO was here

import { DataMaskStateWithId, Filters } from '@superset-ui/core'; // DODO added 44211751
import componentTypes from 'src/dashboard/util/componentTypes';

export enum Scoping {
  All = 'All',
  Specific = 'Specific',
}

export type User = {
  email: string;
  firstName: string;
  isActive: boolean;
  lastName: string;
  permissions: Record<string, any>;
  roles: Record<string, any>;
  userId: number;
  username: string;
};
export interface DashboardInfo {
  id: number;
  json_metadata: string;
}

/** Chart state of redux */
export type Chart = {
  id: number;
  slice_id: string;
  formData: {
    viz_type: string;
  };
};

/** Root state of redux */
export type RootState = {
  charts: { [key: string]: Chart };
  dashboardLayout: { present: { [key: string]: LayoutItem } };
  dashboardFilters: {};
};

/** State of dashboardLayout in redux */
export type Layout = { [key: string]: LayoutItem };

/** State of charts in redux */
export type Charts = { [key: number]: Chart };

type ComponentTypesKeys = keyof typeof componentTypes;
export type ComponentType = (typeof componentTypes)[ComponentTypesKeys];

/** State of dashboardLayout item in redux */
export type LayoutItem = {
  children: string[];
  parents: string[];
  type: ComponentType;
  id: string;
  meta: {
    chartId: number;
    height: number;
    sliceName?: string;
    text?: string;
    uuid: string;
    width: number;
  };
};
