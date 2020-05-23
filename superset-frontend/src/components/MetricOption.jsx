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

import { InfoTooltipWithTrigger } from '@superset-ui/control-utils';
import ColumnTypeLabel from './ColumnTypeLabel';

const propTypes = {
  metric: PropTypes.object.isRequired,
  openInNewWindow: PropTypes.bool,
  showFormula: PropTypes.bool,
  showType: PropTypes.bool,
  url: PropTypes.string,
};
const defaultProps = {
  showFormula: true,
  showType: false,
};

export default function MetricOption({
  metric,
  openInNewWindow,
  showFormula,
  showType,
  url,
}) {
  const verbose = metric.verbose_name || metric.metric_name || metric.label;
  const link = url ? (
    <a href={url} target={openInNewWindow ? '_blank' : null}>
      {verbose}
    </a>
  ) : (
    verbose
  );
  return (
    <div className="metric-option">
      {showType && <ColumnTypeLabel type="expression" />}
      <span className="option-label">{link}</span>
      {metric.description && (
        <InfoTooltipWithTrigger
          className="text-muted"
          icon="info"
          tooltip={metric.description}
          label={`descr-${metric.metric_name}`}
        />
      )}
      {showFormula && (
        <InfoTooltipWithTrigger
          className="text-muted"
          icon="question-circle-o"
          tooltip={metric.expression}
          label={`expr-${metric.metric_name}`}
        />
      )}
      {metric.warning_text && (
        <InfoTooltipWithTrigger
          className="text-danger"
          icon="warning"
          tooltip={metric.warning_text}
          label={`warn-${metric.metric_name}`}
        />
      )}
    </div>
  );
}
MetricOption.propTypes = propTypes;
MetricOption.defaultProps = defaultProps;
