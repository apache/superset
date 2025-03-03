// DODO was here
import { useCallback, useEffect, useState } from 'react';
import {
  AxisType,
  BinaryQueryObjectFilterClause,
  DTTM_ALIAS,
  DataRecordValue,
  getColumnLabel,
  getNumberFormatter,
  getTimeFormatter,
} from '@superset-ui/core';
import { ECBasicOption } from 'echarts/types/src/util/types'; // DODO added 45525377
import { EchartsMixedTimeseriesChartTransformedProps } from './types';
import Echart from '../components/Echart';
import { EventHandlers } from '../types';
import { formatSeriesName } from '../utils/series';

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
  emitCrossFilters,
  seriesBreakdown,
  onContextMenu,
  onFocusedSeries,
  xValueFormatter,
  xAxis,
  refs,
  coltypeMapping,
}: EchartsMixedTimeseriesChartTransformedProps) {
  const { showValue, showValueB } = formData; // DODO added 45525377

  const isFirstQuery = useCallback(
    (seriesIndex: number) => seriesIndex < seriesBreakdown,
    [seriesBreakdown],
  );

  const getCrossFilterDataMask = useCallback(
    (seriesName, seriesIndex) => {
      const selected: string[] = Object.values(selectedValues || {});
      let values: string[];
      if (selected.includes(seriesName)) {
        values = selected.filter(v => v !== seriesName);
      } else {
        values = [seriesName];
      }

      const currentGroupBy = isFirstQuery(seriesIndex) ? groupby : groupbyB;
      const currentLabelMap = isFirstQuery(seriesIndex) ? labelMap : labelMapB;
      const groupbyValues = values
        .map(value => currentLabelMap?.[value])
        .filter(value => !!value);

      return {
        dataMask: {
          extraFormData: {
            // @ts-ignore
            filters:
              values.length === 0
                ? []
                : [
                    ...currentGroupBy.map((col, idx) => {
                      const val: DataRecordValue[] = groupbyValues.map(
                        v => v[idx],
                      );
                      if (val === null || val === undefined)
                        return {
                          col,
                          op: 'IS NULL' as const,
                        };
                      return {
                        col,
                        op: 'IN' as const,
                        val: val as (string | number | boolean)[],
                      };
                    }),
                  ],
          },
          filterState: {
            value: !groupbyValues.length ? null : groupbyValues,
            selectedValues: values.length ? values : null,
          },
        },
        isCurrentValueSelected: selected.includes(seriesName),
      };
    },
    [groupby, groupbyB, isFirstQuery, labelMap, labelMapB, selectedValues],
  );

  const handleChange = useCallback(
    (seriesName: string, seriesIndex: number) => {
      const isFirst = isFirstQuery(seriesIndex);
      if (
        !emitCrossFilters ||
        (isFirst && groupby.length === 0) ||
        (!isFirst && groupbyB.length === 0)
      ) {
        return;
      }

      setDataMask(getCrossFilterDataMask(seriesName, seriesIndex).dataMask);
    },
    [
      isFirstQuery,
      emitCrossFilters,
      groupby.length,
      groupbyB.length,
      setDataMask,
      getCrossFilterDataMask,
    ],
  );

  const eventHandlers: EventHandlers = {
    click: props => {
      const { seriesName, seriesIndex } = props;
      handleChange(seriesName, seriesIndex);
    },
    mouseout: () => {
      onFocusedSeries(null);
    },
    mouseover: params => {
      onFocusedSeries(params.seriesName);
    },
    contextmenu: async eventParams => {
      if (onContextMenu) {
        eventParams.event.stop();
        const { data, seriesName, seriesIndex } = eventParams;
        const pointerEvent = eventParams.event.event;
        const drillToDetailFilters: BinaryQueryObjectFilterClause[] = [];
        const drillByFilters: BinaryQueryObjectFilterClause[] = [];
        const isFirst = isFirstQuery(seriesIndex);
        const values = [
          ...(eventParams.name ? [eventParams.name] : []),
          ...((isFirst ? labelMap : labelMapB)[eventParams.seriesName] || []),
        ];
        if (data && xAxis.type === AxisType.Time) {
          drillToDetailFilters.push({
            col:
              xAxis.label === DTTM_ALIAS
                ? formData.granularitySqla
                : xAxis.label,
            grain: formData.timeGrainSqla,
            op: '==',
            val: data[0],
            formattedVal: xValueFormatter(data[0]),
          });
        }
        [
          ...(data && xAxis.type === AxisType.Category ? [xAxis.label] : []),
          ...(isFirst ? formData.groupby : formData.groupbyB),
        ].forEach((dimension, i) =>
          drillToDetailFilters.push({
            col: dimension,
            op: '==',
            val: values[i],
            formattedVal: String(values[i]),
          }),
        );

        [...(isFirst ? formData.groupby : formData.groupbyB)].forEach(
          (dimension, i) =>
            drillByFilters.push({
              col: dimension,
              op: '==',
              val: values[i],
              formattedVal: formatSeriesName(values[i], {
                timeFormatter: getTimeFormatter(formData.dateFormat),
                numberFormatter: getNumberFormatter(formData.numberFormat),
                coltype: coltypeMapping?.[getColumnLabel(dimension)],
              }),
            }),
        );
        const hasCrossFilter =
          (isFirst && groupby.length > 0) || (!isFirst && groupbyB.length > 0);

        onContextMenu(pointerEvent.clientX, pointerEvent.clientY, {
          drillToDetail: drillToDetailFilters,
          crossFilter: hasCrossFilter
            ? getCrossFilterDataMask(seriesName, seriesIndex)
            : undefined,
          drillBy: {
            filters: drillByFilters,
            groupbyFieldName: isFirst ? 'groupby' : 'groupby_b',
            adhocFilterFieldName: isFirst ? 'adhoc_filters' : 'adhoc_filters_b',
          },
        });
      }
    },
  };

  // DODO added start 45525377
  const getCurrentLabelState = (
    series: Array<{ label?: { show: boolean; position: string } }>,
  ) => series.map(s => s.label?.show)[0];

  const [alteredEchartsOptions, setEchartsOptions] = useState(echartOptions);
  const [isVisibleNow, setIsVisible] = useState(false);

  useEffect(() => {
    setEchartsOptions(echartOptions);
    const current = getCurrentLabelState(
      echartOptions.series as Array<{
        label?: { show: boolean; position: string };
      }>,
    );
    setIsVisible(!current);
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
  // DODO added stop 45525377

  return (
    <>
      {/* DODO added 45525377 */}
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
        refs={refs}
        height={height}
        width={width}
        echartOptions={alteredEchartsOptions} // DODO changed 45525377
        eventHandlers={eventHandlers}
        selectedValues={selectedValues}
      />
    </>
  );
}
