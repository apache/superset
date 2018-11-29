/* eslint-disable no-magic-numbers */

import { ExtensibleFunction, isRequired } from '@superset-ui/core';

export const PREVIEW_TIME = new Date(Date.UTC(2017, 1, 14, 11, 22, 33));

export default class TimeFormatter extends ExtensibleFunction {
  constructor({
    id = isRequired('config.id'),
    label,
    description = '',
    formatFunc = isRequired('config.formatFunc'),
    useLocalTime = false,
  } = {}) {
    super((...args) => this.format(...args));

    this.id = id;
    this.label = label || id;
    this.description = description;
    this.formatFunc = formatFunc;
    this.useLocalTime = useLocalTime;
  }

  format(value) {
    if (value === null || value === undefined) {
      return value;
    }

    return this.formatFunc(value);
  }

  preview(value = PREVIEW_TIME) {
    return `${value.toUTCString()} => ${this.format(value)}`;
  }
}
