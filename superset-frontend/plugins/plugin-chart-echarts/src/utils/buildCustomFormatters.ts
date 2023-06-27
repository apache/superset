import {
  Currency,
  CurrencyFormatter,
  ensureIsArray,
  getNumberFormatter,
  isDefined,
  isSavedMetric,
  QueryFormMetric,
  ValueFormatter,
} from '@superset-ui/core';

export const buildCustomFormatters = (
  metrics: QueryFormMetric | QueryFormMetric[] | undefined,
  currencyFormats: Record<string, Currency>,
  columnFormats: Record<string, string>,
  d3Format: string | undefined,
  labelMap: Record<string, string[]> = {},
  seriesNames: string[] = [],
) => {
  const metricsArray = ensureIsArray(metrics);
  if (metricsArray.length === 1) {
    const metric = metricsArray[0];
    if (isSavedMetric(metric)) {
      return {
        [metric]: currencyFormats[metric]
          ? new CurrencyFormatter({
              d3Format: columnFormats[metric] ?? d3Format,
              currency: currencyFormats[metric],
            })
          : getNumberFormatter(columnFormats[metric] ?? d3Format),
      };
    }
    return {};
  }
  return seriesNames.reduce((acc, name) => {
    if (!isDefined(name)) {
      return acc;
    }

    const metricName = labelMap[name]?.[0];
    const isSaved =
      metricName &&
      // string equality checks if it is a saved metric
      metricsArray?.some(metric => metric === metricName);
    const actualD3Format = isSaved
      ? columnFormats[metricName] ?? d3Format
      : d3Format;
    if (isSaved && currencyFormats[metricName]) {
      return {
        ...acc,
        [name]: new CurrencyFormatter({
          d3Format: actualD3Format,
          currency: currencyFormats[metricName],
        }),
      };
    }
    return {
      ...acc,
      [name]: getNumberFormatter(actualD3Format),
    };
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

export const getFormatter = (
  metrics: QueryFormMetric | QueryFormMetric[] | undefined,
  currencyFormats: Record<string, Currency>,
  columnFormats: Record<string, string>,
  d3Format: string | undefined,
  labelMap: Record<string, string[]> = {},
  seriesNames: string[] = [],
  key?: string,
) =>
  getCustomFormatter(
    buildCustomFormatters(
      metrics,
      currencyFormats,
      columnFormats,
      d3Format,
      labelMap,
      seriesNames,
    ),
    metrics,
    key,
  ) ?? getNumberFormatter(d3Format);
