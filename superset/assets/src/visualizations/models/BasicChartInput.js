import convertKeysToCamelCase from '../../utils/convertKeysToCamelCase';

export default class BasicChartInput {
  constructor(slice, payload, setControlValue) {
    this.annotationData = slice.annotationData;
    this.formData = convertKeysToCamelCase(slice.formData);
    this.payload = payload;
    this.setControlValue = setControlValue;
  }
}
