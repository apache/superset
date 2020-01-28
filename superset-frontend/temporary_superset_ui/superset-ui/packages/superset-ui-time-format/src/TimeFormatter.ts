import { ExtensibleFunction, isRequired } from '@superset-ui/core';
import { TimeFormatFunction } from './types';

export const PREVIEW_TIME = new Date(Date.UTC(2017, 1, 14, 11, 22, 33));

export default class TimeFormatter extends ExtensibleFunction {
  id: string;

  label: string;

  description: string;

  formatFunc: TimeFormatFunction;

  useLocalTime: boolean;

  constructor(config: {
    id: string;
    label?: string;
    description?: string;
    formatFunc: TimeFormatFunction;
    useLocalTime?: boolean;
  }) {
    super((value: Date | null | undefined) => this.format(value));

    const {
      id = isRequired('config.id'),
      label,
      description = '',
      formatFunc = isRequired('config.formatFunc'),
      useLocalTime = false,
    } = config;

    this.id = id;
    this.label = label ?? id;
    this.description = description;
    this.formatFunc = formatFunc;
    this.useLocalTime = useLocalTime;
  }

  format(value: Date | null | undefined) {
    if (value === null || value === undefined) {
      return `${value}`;
    }

    return this.formatFunc(value);
  }

  preview(value: Date = PREVIEW_TIME) {
    return `${value.toUTCString()} => ${this.format(value)}`;
  }
}
