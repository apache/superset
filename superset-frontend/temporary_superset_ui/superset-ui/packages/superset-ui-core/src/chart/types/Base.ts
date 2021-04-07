import { ExtraFormData } from '../../query';

export type HandlerFunction = (...args: unknown[]) => void;

export enum Behavior {
  CROSS_FILTER = 'CROSS_FILTER',
  NATIVE_FILTER = 'NATIVE_FILTER',
}

export enum AppSection {
  EXPLORE = 'EXPLORE',
  DASHBOARD = 'DASHBOARD',
  FILTER_BAR = 'FILTER_BAR',
  FILTER_CONFIG_MODAL = 'FILTER_CONFIG_MODAL',
  EMBEDDED = 'EMBEDDED',
}

export type DataMaskCurrentState = { value?: any; [key: string]: any };

export type DataMask = {
  nativeFilters?: {
    extraFormData?: ExtraFormData;
    currentState: DataMaskCurrentState;
  };
  crossFilters?: {
    extraFormData?: ExtraFormData;
    currentState: DataMaskCurrentState;
  };
  ownFilters?: {
    extraFormData?: ExtraFormData;
    currentState: { [key: string]: any };
  };
};

export type SetDataMaskHook = {
  ({ nativeFilters, crossFilters, ownFilters }: DataMask): void;
};

export interface PlainObject {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export default {};
