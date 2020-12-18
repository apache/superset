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

import AdhocMetricOption from './AdhocMetricOption';
import AdhocMetric from '../AdhocMetric';
import columnType from '../propTypes/columnType';
import savedMetricType from '../propTypes/savedMetricType';
import adhocMetricType from '../propTypes/adhocMetricType';
import { OptionControlLabel } from './OptionControls';

const propTypes = {
  option: PropTypes.oneOfType([savedMetricType, adhocMetricType]).isRequired,
  onMetricEdit: PropTypes.func,
  onRemoveMetric: PropTypes.func,
  columns: PropTypes.arrayOf(columnType),
  savedMetrics: PropTypes.arrayOf(savedMetricType),
  multi: PropTypes.bool,
  datasourceType: PropTypes.string,
};

export default function MetricDefinitionValue({
  option,
  onMetricEdit,
  onRemoveMetric,
  columns,
  savedMetrics,
  datasourceType,
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
      option instanceof AdhocMetric ? option : new AdhocMetric({});

    const metricOptionProps = {
      onMetricEdit,
      onRemoveMetric,
      columns,
      savedMetrics,
      datasourceType,
      adhocMetric,
      savedMetric: savedMetric ?? {},
    };

    return <AdhocMetricOption {...metricOptionProps} />;
  }
  if (typeof option === 'string') {
    return (
      <OptionControlLabel label={option} onRemove={onRemoveMetric} isFunction />
    );
  }
  return null;
}
MetricDefinitionValue.propTypes = propTypes;
