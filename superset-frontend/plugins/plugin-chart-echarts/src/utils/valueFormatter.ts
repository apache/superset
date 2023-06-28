import {
  Currency,
  CurrencyFormatter,
  ensureIsArray,
  getNumberFormatter,
  isSavedMetric,
  QueryFormMetric,
  ValueFormatter,
} from '@superset-ui/core';

export const buildCustomFormatters = (
  metrics: QueryFormMetric | QueryFormMetric[] | undefined,
  currencyFormats: Record<string, Currency>,
  columnFormats: Record<string, string>,
  d3Format: string | undefined,
) => {
  const metricsArray = ensureIsArray(metrics);
  return metricsArray.reduce((acc, metric) => {
    const actualD3Format = isSavedMetric(metric)
      ? columnFormats[metric] ?? d3Format
      : d3Format;
    if (isSavedMetric(metric)) {
      return currencyFormats[metric]
        ? {
            ...acc,
            [metric]: new CurrencyFormatter({
              d3Format: actualD3Format,
              currency: currencyFormats[metric],
            }),
          }
        : {
            ...acc,
            [metric]: getNumberFormatter(actualD3Format),
          };
    }
    return acc;
  }, {});
};

export const getCustomFormatter = (
  customFormatters: Record<string, ValueFormatter>,
  metrics: QueryFormMetric | QueryFormMetric[] | undefined,
  key?: string,
) => {
  const metricsArray = ensureIsArray(metrics);
  if (metricsArray.length === 1 && isSavedMetric(metricsArray[0])) {
    return customFormatters[metricsArray[0]];
  }
  return key ? customFormatters[key] : undefined;
};

export const getValueFormatter = (
  metrics: QueryFormMetric | QueryFormMetric[] | undefined,
  currencyFormats: Record<string, Currency>,
  columnFormats: Record<string, string>,
  d3Format: string | undefined,
  key?: string,
) =>
  getCustomFormatter(
    buildCustomFormatters(metrics, currencyFormats, columnFormats, d3Format),
    metrics,
    key,
  ) ?? getNumberFormatter(d3Format);
