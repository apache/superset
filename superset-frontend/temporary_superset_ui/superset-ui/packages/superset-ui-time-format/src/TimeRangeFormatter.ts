import { ExtensibleFunction } from '@superset-ui/core';
import { TimeRangeFormatFunction } from './types';

// Use type augmentation to indicate that
// an instance of TimeFormatter is also a function
interface TimeRangeFormatter {
  (value: (Date | number | null | undefined)[]): string;
}

class TimeRangeFormatter extends ExtensibleFunction {
  id: string;

  label: string;

  description: string;

  formatFunc: TimeRangeFormatFunction;

  useLocalTime: boolean;

  constructor(config: {
    id: string;
    label?: string;
    description?: string;
    formatFunc: TimeRangeFormatFunction;
    useLocalTime?: boolean;
  }) {
    super((value: (Date | number | null | undefined)[]) => this.format(value));

    const { id, label, description = '', formatFunc, useLocalTime = false } = config;

    this.id = id;
    this.label = label ?? id;
    this.description = description;
    this.formatFunc = formatFunc;
    this.useLocalTime = useLocalTime;
  }

  format(values: (Date | number | null | undefined)[]) {
    return this.formatFunc(values);
  }
}

export default TimeRangeFormatter;
