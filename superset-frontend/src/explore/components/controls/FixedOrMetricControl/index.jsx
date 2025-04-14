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
import { useState } from 'react';
import PropTypes from 'prop-types';
import { css, t } from '@superset-ui/core';
import Label from 'src/components/Label';
import Collapse from 'src/components/Collapse';
import TextControl from 'src/explore/components/controls/TextControl';
import MetricsControl from 'src/explore/components/controls/MetricControl/MetricsControl';
import ControlHeader from 'src/explore/components/ControlHeader';
import PopoverSection from 'src/components/PopoverSection';

const controlTypes = {
  fixed: 'fix',
  metric: 'metric',
};

const propTypes = {
  onChange: PropTypes.func,
  value: PropTypes.object,
  isFloat: PropTypes.bool,
  datasource: PropTypes.object.isRequired,
  default: PropTypes.shape({
    type: PropTypes.oneOf(['fix', 'metric']),
    value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  }),
};

const defaultProps = {
  onChange: () => {},
  default: { type: controlTypes.fixed, value: 5 },
};

const FixedOrMetricControl = props => {
  const { onChange, value, default: defaultValue, datasource } = props;

  // Initialize state from props
  const initialType =
    (value ? value.type : defaultValue.type) || controlTypes.fixed;
  const initialValue = (value ? value.value : defaultValue.value) || '100';

  const [type, setType] = useState(initialType);
  const [fixedValue, setFixedValue] = useState(
    initialType === controlTypes.fixed ? initialValue : '',
  );
  const [metricValue, setMetricValue] = useState(
    initialType === controlTypes.metric ? initialValue : null,
  );

  const handleChange = () => {
    onChange({
      type,
      value: type === controlTypes.fixed ? fixedValue : metricValue,
    });
  };

  const handleTypeChange = newType => {
    setType(newType);
    // We need to call handleChange after state update, so we use a callback
    setTimeout(handleChange, 0);
  };

  const handleFixedValueChange = newFixedValue => {
    setFixedValue(newFixedValue);
    // We need to call handleChange after state update, so we use a callback
    setTimeout(handleChange, 0);
  };

  const handleMetricChange = newMetricValue => {
    setMetricValue(newMetricValue);
    // We need to call handleChange after state update, so we use a callback
    setTimeout(handleChange, 0);
  };

  const displayValue = value || defaultValue;
  const displayType = displayValue.type || controlTypes.fixed;
  const columns = datasource ? datasource.columns : null;
  const metrics = datasource ? datasource.metrics : null;

  return (
    <div>
      <ControlHeader {...props} />
      <Collapse
        ghost
        css={theme => css`
          &.ant-collapse
            > .ant-collapse-item.ant-collapse-no-arrow
            > .ant-collapse-header {
            border: 0px;
            padding: 0px 0px ${theme.gridUnit * 2}px 0px;
            display: inline-block;
          }
          &.ant-collapse-ghost
            > .ant-collapse-item
            > .ant-collapse-content
            > .ant-collapse-content-box {
            padding: 0px;

            & .well {
              margin-bottom: 0px;
              padding: ${theme.gridUnit * 2}px;
            }
          }
        `}
      >
        <Collapse.Panel
          showArrow={false}
          header={
            <Label>
              {type === controlTypes.fixed && <span>{fixedValue}</span>}
              {type === controlTypes.metric && (
                <span>
                  <span>{t('metric')}: </span>
                  <strong>{metricValue ? metricValue.label : null}</strong>
                </span>
              )}
            </Label>
          }
        >
          <div className="well">
            <PopoverSection
              title={t('Fixed')}
              isSelected={displayType === controlTypes.fixed}
              onSelect={() => {
                handleTypeChange(controlTypes.fixed);
              }}
            >
              <TextControl
                isFloat
                onChange={handleFixedValueChange}
                onFocus={() => {
                  handleTypeChange(controlTypes.fixed);
                }}
                value={fixedValue}
              />
            </PopoverSection>
            <PopoverSection
              title={t('Based on a metric')}
              isSelected={displayType === controlTypes.metric}
              onSelect={() => {
                handleTypeChange(controlTypes.metric);
              }}
            >
              <MetricsControl
                name="metric"
                columns={columns}
                savedMetrics={metrics}
                multi={false}
                onFocus={() => {
                  handleTypeChange(controlTypes.metric);
                }}
                onChange={handleMetricChange}
                value={metricValue}
                datasource={datasource}
              />
            </PopoverSection>
          </div>
        </Collapse.Panel>
      </Collapse>
    </div>
  );
};

FixedOrMetricControl.propTypes = propTypes;
FixedOrMetricControl.defaultProps = defaultProps;

export default FixedOrMetricControl;
