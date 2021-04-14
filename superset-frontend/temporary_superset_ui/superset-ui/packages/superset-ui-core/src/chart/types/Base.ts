import { ExtraFormData } from '../../query';
import { JsonObject } from '../..';

export type HandlerFunction = (...args: unknown[]) => void;

export enum Behavior {
  INTERACTIVE_CHART = 'INTERACTIVE_CHART',
  NATIVE_FILTER = 'NATIVE_FILTER',
}

export enum AppSection {
  EXPLORE = 'EXPLORE',
  DASHBOARD = 'DASHBOARD',
  FILTER_BAR = 'FILTER_BAR',
  FILTER_CONFIG_MODAL = 'FILTER_CONFIG_MODAL',
  EMBEDDED = 'EMBEDDED',
}

export type FilterState = { value?: any; [key: string]: any };

export type DataMask = {
  extraFormData?: ExtraFormData;
  filterState?: FilterState;
  ownState?: JsonObject;
};

export type SetDataMaskHook = {
  ({ filterState, extraFormData, ownState }: DataMask): void;
};

export interface PlainObject {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export default {};
