import { ExtensibleFunction, isRequired } from '@superset-ui/core';

export const PREVIEW_VALUE = 12345.432;

export default class NumberFormatter extends ExtensibleFunction {
  constructor({
    id = isRequired('config.id'),
    label,
    description = '',
    formatFunc = isRequired('config.formatFunc'),
  } = {}) {
    super((...args) => this.format(...args));

    this.id = id;
    this.label = label || id;
    this.description = description;
    this.formatFunc = formatFunc;
  }

  format(value) {
    if (value === null || value === undefined || Number.isNaN(value)) {
      return value;
    } else if (value === Number.POSITIVE_INFINITY) {
      return '∞';
    } else if (value === Number.NEGATIVE_INFINITY) {
      return '-∞';
    }

    return this.formatFunc(value);
  }

  preview(value = PREVIEW_VALUE) {
    return `${value} => ${this.format(value)}`;
  }
}
