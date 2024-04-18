// DODO was here
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  DTTM_ALIAS,
  BinaryQueryObjectFilterClause,
  AxisType,
  getTimeFormatter,
  getColumnLabel,
  getNumberFormatter,
  LegendState,
} from '@superset-ui/core';
import { ViewRootGroup, ECBasicOption } from 'echarts/types/src/util/types';
import GlobalModel from 'echarts/types/src/model/Global';
import ComponentModel from 'echarts/types/src/model/Component';
import { EchartsHandler, EventHandlers } from '../types';
import Echart from '../components/Echart';
import { TimeseriesChartTransformedProps } from './types';
import { formatSeriesName } from '../utils/series';
import { ExtraControls } from '../components/ExtraControls';

const TIMER_DURATION = 300;

export default function EchartsTimeseries({
  formData,
  height,
  width,
  echartOptions,
  groupby,
  labelMap,
  selectedValues,
  setDataMask,
  setControlValue,
  legendData = [],
  onContextMenu,
  onLegendStateChanged,
  onFocusedSeries,
  xValueFormatter,
  xAxis,
  refs,
  emitCrossFilters,
  coltypeMapping,
}: TimeseriesChartTransformedProps) {
  const { stack, showValue } = formData;
  const echartRef = useRef<EchartsHandler | null>(null);
  // eslint-disable-next-line no-param-reassign
  refs.echartRef = echartRef;
  const clickTimer = useRef<ReturnType<typeof setTimeout>>();
  const extraControlRef = useRef<HTMLDivElement>(null);
  const [extraControlHeight, setExtraControlHeight] = useState(0);
  useEffect(() => {
    const updatedHeight = extraControlRef.current?.offsetHeight || 0;
    setExtraControlHeight(updatedHeight);
  }, [formData.showExtraControls]);

  const getModelInfo = (target: ViewRootGroup, globalModel: GlobalModel) => {
    let el = target;
    let model: ComponentModel | null = null;
    while (el) {
      // eslint-disable-next-line no-underscore-dangle
      const modelInfo = el.__ecComponentInfo;
      if (modelInfo != null) {
        model = globalModel.getComponent(modelInfo.mainType, modelInfo.index);
        break;
      }
      el = el.parent;
    }
    return model;
  };

  const getCrossFilterDataMask = useCallback(
    (value: string) => {
      const selected: string[] = Object.values(selectedValues);
      let values: string[];
      if (selected.includes(value)) {
        values = selected.filter(v => v !== value);
      } else {
        values = [value];
      }
      const groupbyValues = values.map(value => labelMap[value]);
      return {
        dataMask: {
          extraFormData: {
            filters:
              values.length === 0
                ? []
                : groupby.map((col, idx) => {
                    const val = groupbyValues.map(v => v[idx]);
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
          },
          filterState: {
            label: groupbyValues.length ? groupbyValues : undefined,
            value: groupbyValues.length ? groupbyValues : null,
            selectedValues: values.length ? values : null,
          },
        },
        isCurrentValueSelected: selected.includes(value),
      };
    },
    [groupby, labelMap, selectedValues],
  );

  const handleChange = useCallback(
    (value: string) => {
      if (!emitCrossFilters) {
        return;
      }
      setDataMask(getCrossFilterDataMask(value).dataMask);
    },
    [emitCrossFilters, setDataMask, getCrossFilterDataMask],
  );

  const eventHandlers: EventHandlers = {
    click: props => {
      if (clickTimer.current) {
        clearTimeout(clickTimer.current);
      }
      // Ensure that double-click events do not trigger single click event. So we put it in the timer.
      clickTimer.current = setTimeout(() => {
        const { seriesName: name } = props;
        handleChange(name);
      }, TIMER_DURATION);
    },
    mouseout: () => {
      onFocusedSeries(null);
    },
    mouseover: params => {
      onFocusedSeries(params.seriesName);
    },
    legendselectchanged: payload => {
      onLegendStateChanged?.(payload.selected);
    },
    legendselectall: payload => {
      onLegendStateChanged?.(payload.selected);
    },
    legendinverseselect: payload => {
      onLegendStateChanged?.(payload.selected);
    },
    contextmenu: async eventParams => {
      if (onContextMenu) {
        eventParams.event.stop();
        const { data, seriesName } = eventParams;
        const drillToDetailFilters: BinaryQueryObjectFilterClause[] = [];
        const drillByFilters: BinaryQueryObjectFilterClause[] = [];
        const pointerEvent = eventParams.event.event;
        const values = [
          ...(eventParams.name ? [eventParams.name] : []),
          ...(labelMap[seriesName] ?? []),
        ];
        if (data && xAxis.type === AxisType.time) {
          drillToDetailFilters.push({
            col:
              // if the xAxis is '__timestamp', granularity_sqla will be the column of filter
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
          ...(xAxis.type === AxisType.category && data ? [xAxis.label] : []),
          ...formData.groupby,
        ].forEach((dimension, i) =>
          drillToDetailFilters.push({
            col: dimension,
            op: '==',
            val: values[i],
            formattedVal: String(values[i]),
          }),
        );
        formData.groupby.forEach((dimension, i) => {
          const val = labelMap[seriesName][i];
          drillByFilters.push({
            col: dimension,
            op: '==',
            val,
            formattedVal: formatSeriesName(values[i], {
              timeFormatter: getTimeFormatter(formData.dateFormat),
              numberFormatter: getNumberFormatter(formData.numberFormat),
              coltype: coltypeMapping?.[getColumnLabel(dimension)],
            }),
          });
        });

        onContextMenu(pointerEvent.clientX, pointerEvent.clientY, {
          drillToDetail: drillToDetailFilters,
          crossFilter: getCrossFilterDataMask(seriesName),
          drillBy: { filters: drillByFilters, groupbyFieldName: 'groupby' },
        });
      }
    },
  };

  const zrEventHandlers: EventHandlers = {
    dblclick: params => {
      // clear single click timer
      if (clickTimer.current) {
        clearTimeout(clickTimer.current);
      }
      const pointInPixel = [params.offsetX, params.offsetY];
      const echartInstance = echartRef.current?.getEchartInstance();
      if (echartInstance?.containPixel('grid', pointInPixel)) {
        // do not trigger if click unstacked chart's blank area
        if (!stack && params.target?.type === 'ec-polygon') return;
        // @ts-ignore
        const globalModel = echartInstance.getModel();
        const model = getModelInfo(params.target, globalModel);
        if (model) {
          const { name } = model;
          const legendState: LegendState = legendData.reduce(
            (previous, datum) => ({
              ...previous,
              [datum]: datum === name,
            }),
            {},
          );
          onLegendStateChanged?.(legendState);
        }
      }
    },
  };

  // DODO added
  const getCurrentLabelState = (
    series: Array<{ label: { show: boolean; position: string } }>,
  ) => series.map(s => s?.label?.show)[0];

  const [alteredEchartsOptions, setEchartsOptions] = useState(echartOptions);
  const [isVisibleNow, setIsVisible] = useState(false);

  useEffect(() => {
    setEchartsOptions(echartOptions);
    const current = getCurrentLabelState(
      echartOptions.series as Array<{
        label: { show: boolean; position: string };
      }>,
    );
    setIsVisible(!current);
  }, [echartOptions]);

  // DODO added
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
      <div ref={extraControlRef}>
        <ExtraControls formData={formData} setControlValue={setControlValue} />
      </div>
      {/* DODO added */}
      {showValue && (
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
        ref={echartRef}
        refs={refs}
        height={height - extraControlHeight}
        width={width}
        echartOptions={echartOptions}
        eventHandlers={eventHandlers}
        zrEventHandlers={zrEventHandlers}
        selectedValues={selectedValues}
      />
    </>
  );
}
