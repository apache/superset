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
