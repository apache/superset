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
import { FC } from 'react';
import { t } from '@superset-ui/core';
import { Select, Radio } from 'antd';
import AxisControlSection from './AxisControlSection';
import FormatControlGroup from './FormatControlGroup';
import OpacityControl from './OpacityControl';
import MarkerControlGroup from './MarkerControlGroup';

export interface TimeseriesControlPanelProps {
  variant: 'area' | 'bar' | 'line' | 'scatter' | 'smooth' | 'step';
  showSeriesType?: boolean;
  showStack?: boolean;
  showArea?: boolean;
  showMarkers?: boolean;
  showOpacity?: boolean;
  showOrientation?: boolean;
  values?: Record<string, any>;
  onChange?: (name: string, value: any) => void;
}

const SERIES_TYPE_OPTIONS: Record<string, Array<[string, string]>> = {
  line: [
    ['line', t('Line')],
    ['scatter', t('Scatter')],
    ['smooth', t('Smooth')],
  ],
  area: [
    ['line', t('Line')],
    ['smooth', t('Smooth Line')],
    ['start', t('Step - start')],
    ['middle', t('Step - middle')],
    ['end', t('Step - end')],
  ],
  step: [
    ['start', t('Step - start')],
    ['middle', t('Step - middle')],
    ['end', t('Step - end')],
  ],
  bar: [],
  scatter: [],
  smooth: [],
};

const STACK_OPTIONS = [
  ['stack', t('Stack')],
  ['stream', t('Stream')],
  ['expand', t('Expand')],
];

const TimeseriesControlPanel: FC<TimeseriesControlPanelProps> = ({
  variant,
  showSeriesType = true,
  showStack = false,
  showArea = false,
  showMarkers = true,
  showOpacity = false,
  showOrientation = false,
  values = {},
  onChange = () => {},
}) => {
  const hasAreaOptions = variant === 'area' || showArea;
  const hasBarOptions = variant === 'bar';
  const hasLineOptions = variant === 'line' || variant === 'smooth';

  return (
    <div className="timeseries-control-panel">
      {/* Series Type Selection */}
      {showSeriesType && SERIES_TYPE_OPTIONS[variant] && (
        <div className="control-row" style={{ marginBottom: 24 }}>
          <label>{t('Series Style')}</label>
          <Select
            value={
              values.seriesType ||
              (SERIES_TYPE_OPTIONS[variant][0]
                ? SERIES_TYPE_OPTIONS[variant][0][0]
                : 'line')
            }
            onChange={value => onChange('seriesType', value)}
            style={{ width: '100%' }}
            options={SERIES_TYPE_OPTIONS[variant].map(
              ([value, label]: [string, string]) => ({
                value,
                label,
              }),
            )}
          />
          <small className="text-muted">
            {t('Series chart type (line, smooth, step, etc)')}
          </small>
        </div>
      )}

      {/* Stack Options */}
      {showStack && (
        <div className="control-row" style={{ marginBottom: 24 }}>
          <label>{t('Stacking')}</label>
          <Select
            value={values.stack || null}
            onChange={value => onChange('stack', value)}
            style={{ width: '100%' }}
            allowClear
            placeholder={t('No stacking')}
            options={STACK_OPTIONS.map(([value, label]) => ({
              value,
              label,
            }))}
          />
          <small className="text-muted">
            {t('Stack series on top of each other')}
          </small>
        </div>
      )}

      {/* Bar Orientation */}
      {showOrientation && hasBarOptions && (
        <div className="control-row" style={{ marginBottom: 24 }}>
          <label>{t('Bar Orientation')}</label>
          <Radio.Group
            value={values.orientation || 'vertical'}
            onChange={e => onChange('orientation', e.target.value)}
          >
            <Radio value="vertical">{t('Vertical')}</Radio>
            <Radio value="horizontal">{t('Horizontal')}</Radio>
          </Radio.Group>
          <small
            className="text-muted"
            style={{ display: 'block', marginTop: 8 }}
          >
            {t('Orientation of bar chart')}
          </small>
        </div>
      )}

      {/* Area Chart Options */}
      {hasAreaOptions && (
        <div style={{ marginBottom: 24 }}>
          <h4>{t('Area Chart')}</h4>
          <OpacityControl
            name="opacity"
            label={t('Area opacity')}
            description={t(
              'Opacity of area under the line. Set to 0 to disable area.',
            )}
            value={values.opacity || (variant === 'area' ? 0.2 : 0)}
            onChange={value => onChange('opacity', value)}
          />
        </div>
      )}

      {/* Line/Marker Options */}
      {showMarkers && (hasLineOptions || variant === 'area') && (
        <div style={{ marginBottom: 24 }}>
          <h4>{t('Markers')}</h4>
          <MarkerControlGroup
            values={{
              markerEnabled: values.markerEnabled || false,
              markerSize: values.markerSize || 6,
            }}
            onChange={onChange}
          />
        </div>
      )}

      {/* X Axis Controls */}
      <div style={{ marginBottom: 24 }}>
        <h4>{t('X Axis')}</h4>
        <AxisControlSection
          axis="x"
          showTitle
          showFormat
          showRotation
          showBounds={hasBarOptions}
          showTruncate
          timeFormat
          values={values}
          onChange={onChange}
        />
      </div>

      {/* Y Axis Controls */}
      <div style={{ marginBottom: 24 }}>
        <h4>{t('Y Axis')}</h4>
        <AxisControlSection
          axis="y"
          showTitle
          showFormat
          showBounds
          showLogarithmic
          showMinorTicks
          showTruncate
          values={values}
          onChange={onChange}
        />
      </div>

      {/* Value Formats */}
      <div style={{ marginBottom: 24 }}>
        <h4>{t('Value Formats')}</h4>
        <FormatControlGroup
          showNumber
          showCurrency={hasBarOptions}
          showDate
          showPercentage={showStack}
          values={values}
          onChange={onChange}
        />
      </div>
    </div>
  );
};

export default TimeseriesControlPanel;
