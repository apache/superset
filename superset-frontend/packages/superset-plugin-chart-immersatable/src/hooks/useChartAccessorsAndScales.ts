import { useCallback, useMemo } from 'react';
import { scaleTime, scaleLinear, scaleBand } from '@visx/scale';
import { extent } from 'd3-array';
import { rgb } from 'd3-color';

import {
  ChartData,
  ChartDataItem,
  ChartDataType,
  ChartGenericData,
  ChartGenericDataItem,
} from '../types';

const getDateValue = (
  datum: ChartGenericDataItem | ChartDataItem,
  fieldName: string,
) => new Date(datum[fieldName as never]);

const getNumberValue = (
  datum: ChartGenericDataItem | ChartDataItem,
  fieldName: string,
) => +datum[fieldName as never] as number;

const getStringValue = (
  datum: ChartGenericDataItem | ChartDataItem,
  fieldName: string,
) => {
  if (datum === undefined) return '';
  return datum[fieldName as never] as string;
};

export interface useChartAccessorsAndScalesState {
  data?: ChartGenericData | ChartData;
  xField: string;
  yField: string;
  dataType: ChartDataType;
  width?: number;
  height?: number;
  color?: string;
  hasSeries?: boolean;
  xScaleOptions?: {
    paddingInner?: number;
    paddingOuter?: number;
    padding?: number;
  };
  yScaleOptions?: {
    domain?: [number, number];
  };
}

export const useChartAccessorsAndScales = ({
  data,
  xField,
  yField,
  dataType,
  width,
  height,
  color,
  hasSeries = false,
  xScaleOptions = { paddingOuter: 0, paddingInner: 1 },
  yScaleOptions = {},
}: useChartAccessorsAndScalesState) => {
  const getXAxisValue = useCallback(
    (datum: ChartGenericDataItem | ChartDataItem) => {
      if (dataType === 'date') return getDateValue(datum, xField);
      return getStringValue(datum, xField);
    },
    [dataType, xField],
  );

  const getYAxisValue = useCallback(
    (datum: ChartGenericDataItem | ChartDataItem) =>
      getNumberValue(datum, yField) as number,
    [yField],
  );

  const stringScale = useMemo(() => {
    if (!data || width === undefined || width === null) return null;

    return scaleBand({
      domain: data.map(getXAxisValue).filter(Boolean),
      range: [0, width],
      ...xScaleOptions,
    });
  }, [width, data, getXAxisValue, xScaleOptions]);

  const dateScale = useMemo(() => {
    if (!data || width === undefined || width === null) return null;

    return scaleTime<number>({
      range: [0, width],
      domain: extent(data as never, getXAxisValue as never) as unknown as [
        Date,
        Date,
      ],
    });
  }, [width, data, getXAxisValue]);

  const yScale = useMemo(() => {
    if (!data || height === undefined || height === null) return null;

    let maxYValue = 0;

    if (hasSeries) {
      const uniqueXValues = [...new Set(data.map(getXAxisValue))];
      const totals = uniqueXValues.map(xValue => {
        const subtotal = (data as ChartData)
          .filter(datum => datum.xAxis === xValue)
          .reduce((acc, current) => acc + (current.yAxis as number), 0);
        return subtotal;
      });

      maxYValue = Math.max(...totals);
    } else {
      maxYValue = 5;
    }

    return scaleLinear<number>({
      range: [height, 0],
      domain: yScaleOptions?.domain || [0, maxYValue],
      nice: true,
    });
  }, [data, height, hasSeries, getXAxisValue, getYAxisValue, yScaleOptions]);

  const xScale = useMemo(() => {
    if (dataType === 'date') return dateScale;
    return stringScale;
  }, [dataType, dateScale, stringScale]);

  const colorScale = useMemo(() => {
    if (!color || !data) return null;

    const yValues = data.map(getYAxisValue);
    const yMax = Math.max(...yValues);
    const yMin = Math.min(...yValues);

    return scaleLinear<string>({
      domain: [yMin, yMax],
      range: [rgb(color).brighter().toString(), rgb(color).darker().toString()],
    });
  }, [color, data, getYAxisValue]);

  if (data) return { getXAxisValue, getYAxisValue, xScale, yScale, colorScale };

  return { getXAxisValue, getYAxisValue };
};
