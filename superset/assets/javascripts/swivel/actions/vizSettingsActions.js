import { convertVizSettingsToFormData } from '../formDataUtils/convertToFormData';
import { UPDATE_FORM_DATA } from './globalActions';

export const TOGGLE_SHOW_LEGEND = 'TOGGLE_SHOW_LEGEND';
export function toggleShowLegend() {
  return { type: TOGGLE_SHOW_LEGEND };
}

export const TOGGLE_RICH_TOOLTIP = 'TOGGLE_RICH_TOOLTIP';
export function toggleRichTooltip() {
  return { type: TOGGLE_RICH_TOOLTIP };
}

export function updateFormData(vizSettings) {
  const formData = convertVizSettingsToFormData(vizSettings);
  return { type: UPDATE_FORM_DATA, formData };
}

export const TOGGLE_SEPARATE_CHARTS = 'TOGGLE_SEPARATE_CHARTS';
export function toggleSeparateCharts() {
  return { type: TOGGLE_SEPARATE_CHARTS };
}

