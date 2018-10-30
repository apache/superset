import { createSelector } from 'reselect';
import convertKeysToCamelCase from '../../../utils/convertKeysToCamelCase';

export default class ChartProps {
  constructor({
    width,
    height,
    annotationData,
    datasource,
    filters,
    formData,
    onAddFilter,
    onError,
    payload,
    setControlValue,
    setTooltip,
  }) {
    this.width = width;
    this.height = height;
    this.annotationData = annotationData;
    this.datasource = convertKeysToCamelCase(datasource);
    this.rawDatasource = datasource;
    this.filters = filters;
    this.formData = convertKeysToCamelCase(formData);
    this.rawFormData = formData;
    this.onAddFilter = onAddFilter;
    this.onError = onError;
    this.payload = payload;
    this.setControlValue = setControlValue;
    this.setTooltip = setTooltip;
  }
}

ChartProps.createSelector = function () {
  return createSelector(
    input => input.width,
    input => input.height,
    input => input.annotationData,
    input => input.datasource,
    input => input.filters,
    input => input.formData,
    input => input.onAddFilter,
    input => input.onError,
    input => input.payload,
    input => input.setControlValue,
    input => input.setTooltip,
    (
      width,
      height,
      annotationData,
      datasource,
      filters,
      formData,
      onAddFilter,
      onError,
      payload,
      setControlValue,
      setTooltip,
    ) => new ChartProps({
      width,
      height,
      annotationData,
      datasource,
      filters,
      formData,
      onAddFilter,
      onError,
      payload,
      setControlValue,
      setTooltip,
    }),
  );
};
