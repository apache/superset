/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import { useEffect, useRef, useState } from 'react';
import { sharedControlComponents } from '@superset-ui/chart-controls';
import { t } from '@superset-ui/core';
import Echart from '../components/Echart';
import { EchartsGanttChartTransformedProps } from './types';
import { EventHandlers } from '../types';

const { RadioButtonControl } = sharedControlComponents;

export default function EchartsGantt(props: EchartsGanttChartTransformedProps) {
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
