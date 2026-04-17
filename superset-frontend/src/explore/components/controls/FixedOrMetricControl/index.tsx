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
import { useState, useCallback } from 'react';
import { t } from '@apache-superset/core';
import { Collapse, Label } from '@superset-ui/core/components';
import TextControl from 'src/explore/components/controls/TextControl';
import MetricsControl from 'src/explore/components/controls/MetricControl/MetricsControl';
import ControlHeader from 'src/explore/components/ControlHeader';
import PopoverSection from '@superset-ui/core/components/PopoverSection';

const controlTypes = {
  fixed: 'fix',
  metric: 'metric',
} as const;

interface ControlValue {
  type?: 'fix' | 'metric';
  value?:
    | string
    | number
    | { label?: string; expressionType?: string; sqlExpression?: string };
}

interface MetricValue {
  label?: string;
  expressionType?: string;
  sqlExpression?: string;
  [key: string]: unknown;
}

interface DatasourceType {
  columns?: { column_name: string }[];
  metrics?: { metric_name: string; expression: string }[];
  [key: string]: unknown;
}

interface FixedOrMetricControlProps {
  onChange?: (value: ControlValue) => void;
  value?: ControlValue;
  isFloat?: boolean;
  datasource: DatasourceType;
  default?: ControlValue;
  // ControlHeader props that may be passed through
  name?: string;
  label?: React.ReactNode;
  description?: React.ReactNode;
}

const DEFAULT_VALUE: ControlValue = { type: controlTypes.fixed, value: 5 };

export default function FixedOrMetricControl({
  onChange = () => {},
  value,
  datasource,
  default: defaultValue = DEFAULT_VALUE,
  name,
  label,
  description,
}: FixedOrMetricControlProps) {
  const initialType = (value?.type ??
    defaultValue?.type ??
    controlTypes.fixed) as 'fix' | 'metric';
  const initialRawValue = value?.value ?? defaultValue?.value ?? '100';
  const initialFixedValue =
    initialType === controlTypes.fixed && typeof initialRawValue !== 'object'
      ? initialRawValue
      : '';
  const initialMetricValue =
    initialType === controlTypes.metric && typeof initialRawValue === 'object'
      ? (initialRawValue as MetricValue)
      : null;

  const [type, setTypeState] = useState<'fix' | 'metric'>(initialType);
  const [fixedValue, setFixedValueState] = useState<string | number>(
    initialFixedValue,
  );
  const [metricValue, setMetricValueState] = useState<MetricValue | null>(
    initialMetricValue,
  );

  const setType = useCallback(
    (newType: 'fix' | 'metric') => {
      setTypeState(newType);
      onChange({
        type: newType,
        value:
          newType === controlTypes.fixed
            ? fixedValue
            : (metricValue ?? undefined),
      });
    },
    [fixedValue, metricValue, onChange],
  );

  const setFixedValue = useCallback(
    (newFixedValue: string | number) => {
      setFixedValueState(newFixedValue);
      onChange({
        type,
        value: newFixedValue,
      });
    },
    [type, onChange],
  );

  const setMetric = useCallback(
    (newMetricValue: MetricValue | null) => {
      setMetricValueState(newMetricValue);
      onChange({
        type,
        value: newMetricValue ?? undefined,
      });
    },
    [type, onChange],
  );

  const displayValue = value ?? defaultValue;
  const displayType = displayValue?.type ?? controlTypes.fixed;
  const columns = datasource ? datasource.columns : null;
  const metrics = datasource ? datasource.metrics : null;

  return (
    <div>
      <ControlHeader name={name} label={label} description={description} />
      <Collapse
        ghost
        items={[
          {
            key: 'fixed-or-metric',
            showArrow: false,
            label: (
              <Label>
                {type === controlTypes.fixed && <span>{fixedValue}</span>}
                {type === controlTypes.metric && (
                  <span>
                    <span>{t('metric')}: </span>
                    <strong>{metricValue ? metricValue.label : null}</strong>
                  </span>
                )}
              </Label>
            ),
            children: (
              <div className="well">
                <PopoverSection
                  title={t('Fixed')}
                  isSelected={displayType === controlTypes.fixed}
                  onSelect={() => {
                    setType(controlTypes.fixed);
                  }}
                >
                  <TextControl
                    isFloat
                    onChange={setFixedValue}
                    onFocus={() => {
                      setType(controlTypes.fixed);
                      return {};
                    }}
                    value={fixedValue}
                  />
                </PopoverSection>
                <PopoverSection
                  title={t('Based on a metric')}
                  isSelected={displayType === controlTypes.metric}
                  onSelect={() => {
                    setType(controlTypes.metric);
                  }}
                >
                  <MetricsControl
                    name="metric"
                    columns={columns ?? undefined}
                    savedMetrics={metrics ?? undefined}
                    multi={false}
                    onFocus={() => {
                      setType(controlTypes.metric);
                    }}
                    onChange={setMetric}
                    value={metricValue}
                    datasource={datasource}
                  />
                </PopoverSection>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
