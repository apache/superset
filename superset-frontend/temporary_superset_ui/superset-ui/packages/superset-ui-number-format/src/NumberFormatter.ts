import { ExtensibleFunction, isRequired } from '@superset-ui/core';
import { NumberFormatFunction } from './types';

export const PREVIEW_VALUE = 12345.432;

export interface NumberFormatterConfig {
  id: string;
  label?: string;
  description?: string;
  formatFunc: NumberFormatFunction;
  isInvalid?: boolean;
}

export default class NumberFormatter extends ExtensibleFunction {
  id: string;

  label: string;

  description: string;

  formatFunc: NumberFormatFunction;

  isInvalid: boolean;

  constructor(config: NumberFormatterConfig) {
    super((value: number) => this.format(value));

    const {
      id = isRequired('config.id'),
      label,
      description = '',
      formatFunc = isRequired('config.formatFunc'),
      isInvalid = false,
    } = config;
    this.id = id;
    this.label = label ?? id;
    this.description = description;
    this.formatFunc = formatFunc;
    this.isInvalid = isInvalid;
  }

  format(value: number | null | undefined) {
    if (value === null || value === undefined || Number.isNaN(value)) {
      return `${value}`;
    }
    if (value === Number.POSITIVE_INFINITY) {
      return '∞';
    }
    if (value === Number.NEGATIVE_INFINITY) {
      return '-∞';
    }

    return this.formatFunc(value);
  }

  preview(value: number = PREVIEW_VALUE) {
    return `${value} => ${this.format(value)}`;
  }
}
