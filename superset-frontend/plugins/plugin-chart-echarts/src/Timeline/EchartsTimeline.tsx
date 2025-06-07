import { useEffect, useRef, useState } from 'react';
import { sharedControlComponents } from '@superset-ui/chart-controls';
import { t } from '@superset-ui/core';
import Echart from '../components/Echart';
import { EchartsTimelineChartTransformedProps } from './types';
import { EventHandlers } from '../types';

const { RadioButtonControl } = sharedControlComponents;

export default function EchartsTimeline(
  props: EchartsTimelineChartTransformedProps,
) {
  const {
    height,
    width,
    echartOptions,
    selectedValues,
    refs,
    formData,
    setControlValue,
    onLegendStateChanged,
  } = props;
  const extraControlRef = useRef<HTMLDivElement>(null);
  const [extraHeight, setExtraHeight] = useState(0);

  useEffect(() => {
    const updatedHeight = extraControlRef.current?.offsetHeight ?? 0;
    setExtraHeight(updatedHeight);
  }, [formData.showExtraControls]);

  const eventHandlers: EventHandlers = {
    legendselectchanged: payload => {
      requestAnimationFrame(() => {
        onLegendStateChanged?.(payload.selected);
      });
    },
    legendselectall: payload => {
      requestAnimationFrame(() => {
        onLegendStateChanged?.(payload.selected);
      });
    },
    legendinverseselect: payload => {
      requestAnimationFrame(() => {
        onLegendStateChanged?.(payload.selected);
      });
    },
  };

  return (
    <>
      <div ref={extraControlRef} css={{ textAlign: 'center' }}>
        {formData.showExtraControls ? (
          <RadioButtonControl
            options={[
              [false, t('Plain')],
              [true, t('Subcategories')],
            ]}
            value={formData.subcategories}
            onChange={v => setControlValue?.('subcategories', v)}
          />
        ) : null}
      </div>
      <Echart
        refs={refs}
        height={height - extraHeight}
        width={width}
        echartOptions={echartOptions}
        selectedValues={selectedValues}
        eventHandlers={eventHandlers}
      />
    </>
  );
}
