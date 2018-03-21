export default class AdhocMetric {
  constructor(adhocMetric) {
    this.column = adhocMetric.column;
    this.aggregate = adhocMetric.aggregate;
    this.hasCustomLabel = !!(adhocMetric.hasCustomLabel && adhocMetric.label);
    this.fromFormData = !!adhocMetric.optionName;
    this.label = this.hasCustomLabel ? adhocMetric.label : this.getDefaultLabel();

    this.optionName = adhocMetric.optionName ||
      `metric_${Math.random().toString(36).substring(2, 15)}_${Math.random().toString(36).substring(2, 15)}`;
  }

  getDefaultLabel() {
    return `${this.aggregate || ''}(${(this.column && this.column.column_name) || ''})`;
  }

  duplicateWith(nextFields) {
    return new AdhocMetric({
      ...this,
      ...nextFields,
    });
  }

  equals(adhocMetric) {
    return adhocMetric.label === this.label &&
      adhocMetric.aggregate === this.aggregate &&
      (
        (adhocMetric.column && adhocMetric.column.column_name) ===
        (this.column && this.column.column_name)
      );
  }
}
