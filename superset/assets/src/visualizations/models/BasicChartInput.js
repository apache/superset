import convertKeysToCamelCase from '../../utils/convertKeysToCamelCase';

export default class BasicChartInput {
  constructor(slice, payload, setControlValue) {
    this.annotationData = slice.annotationData;
    this.datasource = convertKeysToCamelCase(slice.datasource);
    this.rawDatasource = slice.datasource;
    this.filters = slice.getFilters();
    this.formData = convertKeysToCamelCase(slice.formData);
    this.onAddFilter = (...args) => {
      slice.addFilter(...args);
    };
    this.onError = (...args) => {
      slice.error(...args);
    };
    this.payload = payload;
    this.setControlValue = setControlValue;
  }
}
