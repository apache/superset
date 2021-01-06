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
import AdhocMetric from '../AdhocMetric';
import columnType from '../propTypes/columnType';
import savedMetricType from '../propTypes/savedMetricType';
import { DraggableOptionControlLabel } from './OptionControls';
import AdhocMetricPopoverTrigger from './AdhocMetricPopoverTrigger';
import { OPTION_TYPES } from './optionTypes';

const propTypes = {
  adhocMetric: PropTypes.instanceOf(AdhocMetric),
  onMetricEdit: PropTypes.func.isRequired,
  onRemoveMetric: PropTypes.func,
  columns: PropTypes.arrayOf(columnType),
  savedMetrics: PropTypes.arrayOf(savedMetricType),
  savedMetric: savedMetricType,
  datasourceType: PropTypes.string,
  onMoveLabel: PropTypes.func,
  onDropLabel: PropTypes.func,
  index: PropTypes.number,
};

class AdhocMetricOption extends React.PureComponent {
  constructor(props) {
    super(props);
    this.onRemoveMetric = this.onRemoveMetric.bind(this);
  }

  onRemoveMetric(e) {
    e.stopPropagation();
    this.props.onRemoveMetric();
  }

  render() {
    const {
      adhocMetric,
      onMetricEdit,
      columns,
      savedMetrics,
      savedMetric,
      datasourceType,
      onMoveLabel,
      onDropLabel,
      index,
    } = this.props;
    return (
      <AdhocMetricPopoverTrigger
        adhocMetric={adhocMetric}
        onMetricEdit={onMetricEdit}
        columns={columns}
        savedMetrics={savedMetrics}
        savedMetric={savedMetric}
        datasourceType={datasourceType}
      >
        <DraggableOptionControlLabel
          savedMetric={savedMetric}
          label={adhocMetric.label}
          onRemove={this.onRemoveMetric}
          onMoveLabel={onMoveLabel}
          onDropLabel={onDropLabel}
          index={index}
          type={OPTION_TYPES.metric}
          isAdhoc
          isFunction
        />
      </AdhocMetricPopoverTrigger>
    );
  }
}

export default AdhocMetricOption;

AdhocMetricOption.propTypes = propTypes;
