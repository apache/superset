// DODO was here
import React, { useCallback, useEffect, useState } from 'react';
import { ECBasicOption } from 'echarts/types/src/util/types';
import { EchartsMixedTimeseriesChartTransformedProps } from './types';
import Echart from '../components/Echart';
import { EventHandlers } from '../types';
import { currentSeries } from '../utils/series';

export default function EchartsMixedTimeseries({
  height,
  width,
  echartOptions,
  setDataMask,
  labelMap,
  labelMapB,
  groupby,
  groupbyB,
  selectedValues,
  formData,
  seriesBreakdown,
}: EchartsMixedTimeseriesChartTransformedProps) {
  const { showValue, showValueB } = formData;

  const isFirstQuery = useCallback(
    (seriesIndex: number) => seriesIndex < seriesBreakdown,
    [seriesBreakdown],
  );

  const handleChange = useCallback(
    (values: string[], seriesIndex: number) => {
      const emitFilter = isFirstQuery(seriesIndex)
        ? formData.emitFilter
        : formData.emitFilterB;
      if (!emitFilter) {
        return;
      }

      const currentGroupBy = isFirstQuery(seriesIndex) ? groupby : groupbyB;
      const currentLabelMap = isFirstQuery(seriesIndex) ? labelMap : labelMapB;
      const groupbyValues = values
        .map(value => currentLabelMap[value])
        .filter(value => !!value);

      setDataMask({
        extraFormData: {
          // @ts-ignore
          filters:
            values.length === 0
              ? []
              : [
                  ...currentGroupBy.map((col, idx) => {
                    const val = groupbyValues.map(v => v[idx]);
                    if (val === null || val === undefined)
                      return {
                        col,
                        op: 'IS NULL',
                      };
                    return {
                      col,
                      op: 'IN',
                      val: val as (string | number | boolean)[],
                    };
                  }),
                ],
        },
        filterState: {
          value: !groupbyValues.length ? null : groupbyValues,
          selectedValues: values.length ? values : null,
        },
      });
    },
    [groupby, groupbyB, labelMap, labelMapB, setDataMask, selectedValues],
  );

  const eventHandlers: EventHandlers = {
    click: props => {
      const { seriesName, seriesIndex } = props;
      const values: string[] = Object.values(selectedValues);
      if (values.includes(seriesName)) {
        handleChange(
          values.filter(v => v !== seriesName),
          seriesIndex,
        );
      } else {
        handleChange([seriesName], seriesIndex);
      }
    },
    mouseout: () => {
      currentSeries.name = '';
    },
    mouseover: params => {
      currentSeries.name = params.seriesName;
    },
  };

  const getCurrentLabelState = (
    series: Array<{ label?: { show: boolean; position: string } }>,
  ) => series.map(s => s && s.label && s?.label.show);

  const [alteredEchartsOptions, setEchartsOptions] = useState(echartOptions);
  const [isVisibleNow, setIsVisible] = useState(false);

  useEffect(() => {
    console.log('Mixed time-series echartOptions', echartOptions);
    setEchartsOptions(echartOptions);
    const current = getCurrentLabelState(
      echartOptions.series as Array<{
        label?: { show: boolean; position: string };
      }>,
    );

    const currentValue = current.length > 0 ? current[0] : false;
    console.log('Current Show/Hide value', current, currentValue);
    setIsVisible(!currentValue);
  }, [echartOptions]);

  const showHideHandler = () => {
    const { series } = alteredEchartsOptions as ECBasicOption & {
      series: Array<{ label: { show: boolean; position: string } }>;
    };
    setIsVisible(!isVisibleNow);

    const echartsOpts = {
      ...alteredEchartsOptions,
      series: series.map(s => ({
        ...s,
        label: {
          ...s.label,
          show: isVisibleNow,
        },
      })),
    };
    setEchartsOptions(echartsOpts);
  };

  return (
    <>
      {(showValue || showValueB) && (
        <div
          style={{
            position: 'absolute',
            marginTop: '5px',
            zIndex: 1,
            bottom: '0',
          }}
        >
          <span
            style={{
              fontSize: '10px',
              marginTop: '5px',
              fontStyle: 'italic',
            }}
            role="button"
            tabIndex={0}
            onClick={showHideHandler}
          >
            {isVisibleNow ? 'Show' : 'Hide'} values
          </span>
        </div>
      )}
      <Echart
        height={height}
        width={width}
        echartOptions={alteredEchartsOptions}
        eventHandlers={eventHandlers}
        selectedValues={selectedValues}
      />
    </>
  );
}
