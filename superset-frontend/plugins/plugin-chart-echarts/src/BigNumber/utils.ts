// DODO was here

import moment from 'moment';
import {
  getTimeFormatter,
  getTimeFormatterForGranularity,
  smartDateFormatter,
  TimeGranularity,
} from '@superset-ui/core';

import { ConditionalFormattingConfig, COMPARATOR } from './types';
import { MULTIPLE_VALUE_COMPARATORS, DEFAULT_COLOR } from './constants';

const parseMetricValue = (metricValue: number | string | null) => {
  if (typeof metricValue === 'string') {
    const dateObject = moment.utc(metricValue, moment.ISO_8601, true);
    if (dateObject.isValid()) {
      return dateObject.valueOf();
    }
    return null;
  }
  return metricValue;
};

const getDateFormatter = (
  timeFormat: string,
  granularity?: TimeGranularity,
  fallbackFormat?: string | null,
) =>
  timeFormat === smartDateFormatter.id
    ? getTimeFormatterForGranularity(granularity)
    : getTimeFormatter(timeFormat ?? fallbackFormat);

const calculateColor = (
  className: string | undefined,
  positiveColor: string | undefined,
  negativeColor: string | undefined,
) => {
  if (!className) return DEFAULT_COLOR;
  if (className.includes('positive')) return positiveColor;
  if (className.includes('negative')) return negativeColor;
  return DEFAULT_COLOR;
};

const parseDataGetColor = (
  inputData: ConditionalFormattingConfig,
  value: number,
) => {
  const {
    operator,
    targetValue,
    targetValueLeft,
    targetValueRight,
    colorScheme,
  } = inputData;

  if (!operator) return DEFAULT_COLOR;

  if (!targetValue && (!targetValueLeft || !targetValueRight)) {
    return DEFAULT_COLOR;
  }

  if (
    MULTIPLE_VALUE_COMPARATORS.includes(operator) &&
    (targetValueLeft === undefined || targetValueRight === undefined)
  ) {
    return DEFAULT_COLOR;
  }

  if (
    operator !== COMPARATOR.NONE &&
    !MULTIPLE_VALUE_COMPARATORS.includes(operator) &&
    targetValue === undefined
  ) {
    return DEFAULT_COLOR;
  }

  if (
    operator !== COMPARATOR.NONE &&
    !MULTIPLE_VALUE_COMPARATORS.includes(operator) &&
    targetValue === undefined
  ) {
    return DEFAULT_COLOR;
  }

  const targetValueLeftNum = targetValueLeft ? Number(targetValueLeft) : null;
  const targetValueRightNum = targetValueRight
    ? Number(targetValueRight)
    : null;

  switch (operator) {
    case COMPARATOR.NONE:
      return colorScheme;
      break;
    case COMPARATOR.GREATER_THAN:
      if (!targetValue) return DEFAULT_COLOR;

      return value > targetValue ? colorScheme : DEFAULT_COLOR;
      break;
    case COMPARATOR.LESS_THAN:
      if (!targetValue) return DEFAULT_COLOR;

      return value < targetValue ? colorScheme : DEFAULT_COLOR;
      break;
    case COMPARATOR.GREATER_OR_EQUAL:
      if (!targetValue) return DEFAULT_COLOR;

      return value >= targetValue ? colorScheme : DEFAULT_COLOR;
      break;
    case COMPARATOR.LESS_OR_EQUAL:
      if (!targetValue) return DEFAULT_COLOR;

      return value <= targetValue ? colorScheme : DEFAULT_COLOR;
      break;
    case COMPARATOR.EQUAL:
      return value === targetValue ? colorScheme : DEFAULT_COLOR;
      break;
    case COMPARATOR.NOT_EQUAL:
      return value !== targetValue ? colorScheme : DEFAULT_COLOR;
      break;
    case COMPARATOR.BETWEEN:
      if (!targetValueLeftNum || !targetValueRightNum) return DEFAULT_COLOR;

      return value > targetValueLeftNum && value < targetValueRightNum
        ? colorScheme
        : DEFAULT_COLOR;
      break;
    case COMPARATOR.BETWEEN_OR_EQUAL:
      if (!targetValueLeftNum || !targetValueRightNum) return DEFAULT_COLOR;

      return value >= targetValueLeftNum && value <= targetValueRightNum
        ? colorScheme
        : DEFAULT_COLOR;
      break;
    case COMPARATOR.BETWEEN_OR_LEFT_EQUAL:
      if (!targetValueLeftNum || !targetValueRightNum) return DEFAULT_COLOR;

      return value >= targetValueLeftNum && value < targetValueRightNum
        ? colorScheme
        : DEFAULT_COLOR;
      break;
    case COMPARATOR.BETWEEN_OR_RIGHT_EQUAL:
      if (!targetValueLeftNum || !targetValueRightNum) return DEFAULT_COLOR;

      return value > targetValueLeftNum && value <= targetValueRightNum
        ? colorScheme
        : DEFAULT_COLOR;
      break;
    default:
      return DEFAULT_COLOR;
      break;
  }
};

const getColors = (
  inputData: ConditionalFormattingConfig[],
  value: number | null | undefined,
) => {
  if (!inputData || !inputData.length) return [DEFAULT_COLOR];
  if (!value) return [DEFAULT_COLOR];

  const parsedColors = inputData.map(data =>
    parseDataGetColor(data, value),
  ) as string[];

  return parsedColors;
};

export { calculateColor, getDateFormatter, parseMetricValue, getColors };
