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
import React from 'react';
import PropTypes from 'prop-types';
import columnType from 'src/explore/propTypes/columnType';
import { OptionControlLabel } from 'src/explore/components/OptionControls';
import { OPTION_TYPES } from 'src/explore/components/optionTypes';
import AdhocMetricOption from './AdhocMetricOption';
import AdhocMetric from './AdhocMetric';
import savedMetricType from './savedMetricType';
import adhocMetricType from './adhocMetricType';

const propTypes = {
  option: PropTypes.oneOfType([savedMetricType, adhocMetricType]).isRequired,
  index: PropTypes.number.isRequired,
  onMetricEdit: PropTypes.func,
  onRemoveMetric: PropTypes.func,
  onMoveLabel: PropTypes.func,
  onDropLabel: PropTypes.func,
  columns: PropTypes.arrayOf(columnType),
  savedMetrics: PropTypes.arrayOf(savedMetricType),
  savedMetricsOptions: PropTypes.arrayOf(savedMetricType),
  multi: PropTypes.bool,
  datasourceType: PropTypes.string,
};

export default function MetricDefinitionValue({
  option,
  onMetricEdit,
  onRemoveMetric,
  columns,
  savedMetrics,
  savedMetricsOptions,
  datasourceType,
  onMoveLabel,
  onDropLabel,
  index,
}) {
  const getSavedMetricByName = metricName =>
    savedMetrics.find(metric => metric.metric_name === metricName);

  let savedMetric;
  if (option.metric_name) {
    savedMetric = option;
  } else if (typeof option === 'string') {
    savedMetric = getSavedMetricByName(option);
  }

  if (option instanceof AdhocMetric || savedMetric) {
    const adhocMetric =
      option instanceof AdhocMetric ? option : new AdhocMetric({ isNew: true });

    const metricOptionProps = {
      onMetricEdit,
      onRemoveMetric,
      columns,
      savedMetricsOptions,
      datasourceType,
      adhocMetric,
      onMoveLabel,
      onDropLabel,
      index,
      savedMetric: savedMetric ?? {},
    };

    return <AdhocMetricOption {...metricOptionProps} />;
  }
  if (typeof option === 'string') {
    return (
      <OptionControlLabel
        label={option}
        onRemove={onRemoveMetric}
        onMoveLabel={onMoveLabel}
        onDropLabel={onDropLabel}
        type={OPTION_TYPES.metric}
        index={index}
        isFunction
      />
    );
  }
  return null;
}
MetricDefinitionValue.propTypes = propTypes;
