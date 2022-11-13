import { DEFAULT_LEGEND_FORM_DATA } from '../constants';
import { EchartsBubbleFormData } from './types';

export const DEFAULT_FORM_DATA: EchartsBubbleFormData = {
  ...DEFAULT_LEGEND_FORM_DATA,
  emitFilter: false,
  logXAis: false,
  logYAxis: false,
};
