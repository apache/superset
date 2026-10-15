import { getBootstrapDataFromDocument } from './mapStyles';

export interface ConstantLabelMap {
  [key: string]: string;
}

type BootstrapData = {
  common?: {
    constant_labels: ConstantLabelMap;
  };
};

// Keep in sync with superset/constants.py.

export const EMPTY_FILTER_SQL_EXPRESSION = '1 = 0';
export const EMPTY_STRING = '<empty string>';
export const FALSE_STRING = 'FALSE';
export const NULL_STRING = '<NULL>';
export const TRUE_STRING = 'TRUE';

const bootstrapData: ConstantLabelMap =
  (getBootstrapDataFromDocument() as BootstrapData | undefined)?.common
    ?.constant_labels || {};

export const getConstantLabel = (value: string): string =>
  bootstrapData[value] ?? value;
