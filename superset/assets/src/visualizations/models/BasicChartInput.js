export default class BasicChartInput {
  constructor(slice, payload, setControlValue) {
    this.width = slice.width();
    this.height = slice.height();
    this.annotationData = slice.annotationData;
    this.formData = slice.formData;

    this.payload = payload;
    this.setControlValue = setControlValue;
  }
}
