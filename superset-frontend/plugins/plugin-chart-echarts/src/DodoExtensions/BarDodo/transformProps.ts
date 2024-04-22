// DODO added
// @ts-nocheck
import {
  CategoricalColorNamespace,
  getNumberFormatter,
  NumberFormats,
} from '@superset-ui/core';
import { EChartsOption } from 'echarts';
import moment from 'moment';

import {
  DEFAULT_FORM_DATA,
  EchartsBarChartProps,
  EchartsBarFormData,
  BarChartTransformedProps,
} from './types';
import { BAR_CHART_CONSTANTS } from '../../constants';
import { DEFAULT_LEGEND_FORM_DATA } from '../../types';
import { parseYAxisBound } from '../../utils/controls';
import { createTooltipElement } from '../../utils/tooltipGeneration';

export default function transformProps(
  chartProps: EchartsBarChartProps,
): BarChartTransformedProps {
  const {
    formData,
    height,
    queriesData,
    width,
    datasource,
    datasource: { columns: datasourceColumns },
  } = chartProps;
  const { metrics: chartPropsDatasourceMetrics, columnFormats } = datasource;
  const { data = [] } = queriesData[0];

  const {
    colorScheme,
    emitFilter,
    showValuesTotal,
    showValuesSeparately,
    stack,
    contribution = false,
    yAxisBounds,
    showLegend = false,
    orderBars = false,
    zoomableY,
    zoomableX,
  }: EchartsBarFormData = {
    ...DEFAULT_LEGEND_FORM_DATA,
    ...DEFAULT_FORM_DATA,
    ...formData,
  };

  // TODO:
  // const chartPadding = getPadding(showLegend, legendOrientation, addYAxisLabelOffset, zoomable);

  const { metrics, groupby, columns } = formData;
  let { yAxisFormat } = formData;
  const yAxisFormatOriginal = yAxisFormat;

  const FALLBACK_NAME = '<NULL>';

  // eslint-disable-next-line no-console
  console.log('[plugin-chart-echarts - Bar chart]:0.17.84', 'DODO was here');

  // TODO: fix this
  // @ts-ignore
  const finalMetrics: string[] = metrics
    ?.map((metric: any) => {
      if (typeof metric === 'string') return metric;
      return metric.label;
    })
    .filter(metricName => metricName);

  /**
   * Needed for yAxis for d3 formating
   */
  const findMetric = (arr: any[], metricName: string) =>
    arr.filter(metric => metric.metric_name === metricName);

  if (
    !yAxisFormat &&
    chartProps.datasource &&
    chartPropsDatasourceMetrics &&
    metrics
  ) {
    // @ts-ignore
    metrics.forEach((metricName: string) => {
      const [foundMetric] = findMetric(chartPropsDatasourceMetrics, metricName);
      if (foundMetric?.d3format) yAxisFormat = foundMetric.d3format;
    });
  }
  const colorFn = CategoricalColorNamespace.getScale(colorScheme as string);

  const formatter = getNumberFormatter(
    contribution ? NumberFormats.PERCENT_1_POINT : yAxisFormat,
  );

  const getValuesFromObj = (
    arr: string[] | number[] | undefined,
    obj: Record<string, any>,
  ) => (arr ? arr.map((propName: any) => obj[propName] || null) : [null]);

  const groupByArrayByObjKey = (xs: any, key: string) =>
    xs.reduce((rv: any, x: any) => {
      // eslint-disable-next-line
      (rv[x[key]] = rv[x[key]] || []).push(x);
      return rv;
    }, {});

  const calculateSum = (arr: number[]) =>
    arr.reduce(
      (previousValue: number, currentValue: number) =>
        previousValue + currentValue,
    );

  const makeNumber = (el: string | number | null | undefined) =>
    el !== undefined ? Number(el) : 0;

  const convertToPercentages = (arr: (number | string)[]) => {
    const transformedArray = arr.map(n =>
      makeNumber(makeNumber(n).toFixed(20)),
    );
    const sum = calculateSum(transformedArray);
    const convertedValues = [] as any;

    transformedArray.forEach(element => {
      if (sum === 0) convertedValues.push(0);
      else {
        // we are rounding this, so that javascript will calculate correctly (100.00002 -> 100)
        const number = element / sum;
        const roundedNumber = makeNumber(makeNumber(number).toFixed(20));

        convertedValues.push(roundedNumber);
      }
    });

    return convertedValues;
  };

  const convertDate = (date: Date) => moment(date).format('DD-MM-YYYY');

  const addMissingData = (values: any[], expectedNames: string[]) =>
    expectedNames.map(name => {
      const found = values.find(v => v.dataName === name);

      // we need to fill empty space with 0 values, or data will be shifted
      const fallbackObj = { dataName: name, dataValue: 0, dataSumInSeries: 0 };
      return found || fallbackObj;
    });

  // const seriesesVals = [] as any;
  const seriesesValsOriginal = [] as any;

  const expectedDataNames = [] as any;
  const expectedLegendNames = [] as any;

  const sortedData = !orderBars
    ? data
    : data.sort((a: any, b: any) => {
        if (a[groupby[0]] < b[groupby[0]]) return -1;
        if (a[groupby[0]] > b[groupby[0]]) return 1;
        return 0;
      });

  const findElementByKey = (arr: any[], elementName: string, key: string) =>
    arr.filter(el => el[key] === elementName);

  const isItDateFormat = (el: string | null) =>
    !el
      ? false
      : el.toLowerCase().includes('time') || el.toLowerCase().includes('date');

  const originalData = sortedData
    .map(datum => {
      const value = getValuesFromObj(groupby, datum)[0];
      const checkedValue = value || FALLBACK_NAME;
      const columnnType = findElementByKey(
        datasourceColumns,
        groupby[0],
        'column_name',
      );

      const isSeriesDateFormat = isItDateFormat(
        columnnType[0] ? columnnType[0].type : null,
      );

      seriesesValsOriginal.push(
        isSeriesDateFormat ? convertDate(new Date(checkedValue)) : checkedValue,
      );

      const groupedValues = groupby?.map(groupingKey => {
        // groupingKey = Date (series) -> only 1 is supported now
        /**
         * preparing a name for the graph:
         * - SUM(SalesWithDiscount), Delivery|Dine-in|Takeaway
         * - count, Delivery|Dine-in|Takeaway
         */

        const values = finalMetrics.map(metricName => {
          const breakdownName = columns?.map(colName => {
            const columnnType = findElementByKey(
              datasourceColumns,
              colName,
              'column_name',
            );
            const isSeriesDateFormat = isItDateFormat(
              columnnType[0] ? columnnType[0].type : null,
            );
            // @ts-ignore
            return isSeriesDateFormat
              ? convertDate(new Date(datum[colName]))
              : datum[colName];
          });
          const finalBrName = breakdownName?.length
            ? breakdownName.join()
            : null;

          if (finalBrName) expectedLegendNames.push(finalBrName);

          // when there is only 1 metric, no need to print it's name
          const dataName =
            finalMetrics.length > 1
              ? `${metricName}, ${finalBrName}`
              : finalBrName;

          expectedDataNames.push(dataName);

          return {
            dataName,
            dataValue: datum[metricName] || 0,
            dataMetricName: metricName,
            [groupingKey]: datum[groupingKey] || FALLBACK_NAME,
          };
        });

        return values.flat();
      });

      return groupedValues?.flat();
    })
    .flat();

  const uniqExpectedDataNames = [...new Set(expectedDataNames)] as string[];
  const uniqExpectedLegendNames = [...new Set(expectedLegendNames)].sort(
    (a: any, b: any) => {
      if (a < b) return -1;
      if (a > b) return 1;
      return 0;
    },
  ) as string[];

  // TODO: for now only 1 series is supported, hence - groupby[0]
  const groupByArrayDate = groupByArrayByObjKey(originalData, groupby[0]);

  const almostFinalValues = [] as any[];

  const transformForContribution = (arr: any[], groupBy: string) => {
    const groupedValues = groupByArrayByObjKey(arr, groupBy);

    const transformedDataArray = [] as any;

    Object.keys(groupedValues).forEach(key => {
      const values = groupedValues[key];
      const convertedValues = convertToPercentages(
        values.map((v: any) => v.dataValue),
      );

      const newValues = values.map((v: any, index: number) => ({
        ...v,
        dataValue: convertedValues[index],
      }));

      transformedDataArray.push(newValues);
    });

    return transformedDataArray.flat();
  };

  Object.keys(groupByArrayDate).forEach(key => {
    const value = groupByArrayDate[key];
    const transformedWithContribution = contribution
      ? transformForContribution(value, 'dataMetricName')
      : value;

    const addMissingDataResult = addMissingData(
      transformedWithContribution,
      uniqExpectedDataNames,
    );

    almostFinalValues.push(addMissingDataResult);
  });

  const uniqueSeriesNames = [...new Set(seriesesValsOriginal)];
  const uniqFinalValues = [...new Set(almostFinalValues.flat())];

  const groupByArray = groupByArrayByObjKey(uniqFinalValues, 'dataName');

  const groupByArrayForTotal = groupByArrayByObjKey(
    uniqFinalValues,
    groupby[0],
  );

  const seriesTotals = [] as any;

  Object.keys(groupByArrayForTotal).forEach(key => {
    if (key !== 'undefined') {
      const value = groupByArrayForTotal[key];

      const pureObject = {
        totalSum: calculateSum(
          value.map((vv: any) => makeNumber(vv.dataValue)),
        ),
        name: key,
      } as any;

      seriesTotals.push(pureObject);
    }
  });

  const finalyParsedData = [] as any;

  Object.keys(groupByArray).forEach(key => {
    const value = groupByArray[key];

    const pureObject = {
      data: value.map((vv: any) => vv.dataValue),
      name: value[0].dataName,
    } as any;

    finalyParsedData.push(pureObject);
  });

  const sorted = finalyParsedData;

  /**
   * Used for tooltip for d3 formating
   */
  const findMetricNameInArray = (
    metrics: any[] | undefined,
    originalSName: string,
  ) => {
    let metricName = originalSName;

    // We either get ['count'] or ['count', 'LA'] or ['LA', '2003']
    const srsNames = originalSName.split(',');

    // we default the metric name to the metrics[0] A or B
    if (metrics && srsNames.length === 1) metricName = metrics[0];
    if (metrics && metrics.length === 1) metricName = metrics[0];
    else {
      // we find the metric name in array
      // @ts-ignore
      metrics.forEach(metr => {
        const index = srsNames?.indexOf(metr);
        if (index >= 0 && srsNames) metricName = srsNames[index];
      });
    }

    return metricName;
  };

  const getMetricNameFromGroups = (sName: string) => ({
    metricName: findMetricNameInArray(metrics, sName),
  });

  const getD3OrOriginalFormat = (
    originalFormat: string | undefined,
    metricName: string,
    columnFormats?: {
      [key: string]: string;
    },
  ) =>
    !originalFormat
      ? columnFormats
        ? columnFormats[metricName]
        : ''
      : originalFormat;

  /**
   * If there is a group in a query, we need to identify to which type A or B this group
   * and metric belongs to.
   */
  const getCorrectFormat = (
    sType: string,
    sName: string,
    yAxisFormat: string | undefined,
  ) => {
    /**
     * If there is a group present - we parse groups array with metrics names
     * to indetify what metrics are behind those metrics names
     */

    const overrideMetricParams = getMetricNameFromGroups(sName);
    const { metricName } = overrideMetricParams;
    return getD3OrOriginalFormat(yAxisFormat, metricName, columnFormats);
  };

  const formatValue = (
    dataValue: number,
    seriesType: string,
    seriesName: string,
  ) => {
    let correctFormat = NumberFormats.SI_3_DIGIT;

    if (seriesType && seriesName) {
      correctFormat = getCorrectFormat(
        seriesType,
        seriesName,
        yAxisFormatOriginal,
      );
    }

    const formatFunction = getNumberFormatter(
      contribution ? NumberFormats.PERCENT_1_POINT : correctFormat,
    );
    const value = formatFunction(dataValue);
    return value;
  };

  const dealWithSeriesLabels = (totalComponentsCount: number) => {
    const startupObj = {
      show: showValuesSeparately || showValuesTotal,
      position: showValuesSeparately ? 'inside' : 'top',
      formatter: (params: any) => {
        if (showValuesTotal && !showValuesSeparately) {
          const { data, seriesType, seriesName, dataIndex, componentIndex } =
            params;
          let dataValue = data;

          if (componentIndex === totalComponentsCount - 1) {
            const sumObj = seriesTotals[dataIndex];
            dataValue = sumObj.totalSum;
            return formatValue(dataValue, seriesType, seriesName);
          }

          return '';
        }

        const { data, seriesType, seriesName } = params;
        const dataValue = data;
        return dataValue ? formatValue(dataValue, seriesType, seriesName) : '';
      },
    };

    return startupObj;
  };

  const getSeries = (preparedSeriesData: { name: any; data: any[] }[]) =>
    preparedSeriesData.map(ser => ({
      data: ser.data,
      name: ser.name,
      type: 'bar',
      itemStyle: {
        color: colorFn(ser.name),
      },
      stack: stack ? 'total' : '',
      emphasis: {
        focus: contribution ? 'none' : 'series',
      },
      label: dealWithSeriesLabels(preparedSeriesData.length),
    }));

  const series: any[] = getSeries(sorted);

  // yAxisBounds need to be parsed to replace incompatible values with undefined
  let [min, max] = (yAxisBounds || []).map(parseYAxisBound);

  // default to 0-100% range when doing row-level contribution chart
  if (contribution && stack) {
    if (min === undefined) min = 0;
    // TODO: need to use library to parse the percentages. sometimes the % sum = 0.9999 or 1.0001
    if (max === undefined) max = 1.002;
  }

  const dataZoomConfig = (zoomableX: boolean, zoomableY: boolean) => {
    const initialArray = [];

    if (zoomableX) {
      initialArray.push({
        start: BAR_CHART_CONSTANTS.dataZoomStart,
        end: BAR_CHART_CONSTANTS.dataZoomEnd,
      });
    }

    if (zoomableY) {
      initialArray.push({
        yAxisIndex: 0,
        filterMode: 'empty',
        width: 30,
        height: '80%',
        showDataShadow: false,
        right: BAR_CHART_CONSTANTS.zoomRight,
      });
    }

    if (zoomableY || zoomableX) {
      initialArray.push({
        type: 'inside',
        start: 0,
        end: 100,
      });
    }

    return initialArray;
  };

  const echartOptions: EChartsOption = {
    grid: {
      top: '10%',
    },
    legend: {
      data: showLegend ? uniqExpectedLegendNames : [],
      align: 'auto',
      orient: 'horizontal',
      type: 'scroll',
      top: 5,
    },
    // @ts-ignore
    dataZoom: dataZoomConfig(zoomableX, zoomableY),
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow',
      },
      formatter: (params: any) => {
        const { axisValueLabel } = params[0];

        const values = params.map((p: any) => {
          let correctFormat = NumberFormats.SI_3_DIGIT;
          correctFormat = getCorrectFormat(
            p.seriesType,
            p.seriesName,
            yAxisFormatOriginal,
          );

          const formatFunction = getNumberFormatter(
            contribution ? NumberFormats.PERCENT_1_POINT : correctFormat,
          );

          return {
            value: p.data ? formatFunction(p.data) : '',
            seriesColor: p.color,
            serName: p.seriesName,
          };
        });

        return createTooltipElement({ axisValueLabel, values });
      },
    },
    series,
    // @ts-ignore
    xAxis: {
      type: 'category',
      data: uniqueSeriesNames,
    },
    yAxis: {
      type: 'value',
      min,
      max,
      axisLabel: { formatter },
    },
  };

  return {
    formData,
    width,
    height,
    echartOptions,
    emitFilter,
    groupby,
    contribution,
  } as any;
}
