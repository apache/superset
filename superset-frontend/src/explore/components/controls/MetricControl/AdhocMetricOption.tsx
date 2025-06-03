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
import { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { OptionControlLabel } from 'src/explore/components/controls/OptionControls';
import { DndItemType } from 'src/explore/components/DndItemType';
import columnType from './columnType';
import AdhocMetric from './AdhocMetric';
import savedMetricType from './savedMetricType';
import AdhocMetricPopoverTrigger from './AdhocMetricPopoverTrigger';

const propTypes = {
  adhocMetric: PropTypes.instanceOf(AdhocMetric),
  onMetricEdit: PropTypes.func.isRequired,
  onRemoveMetric: PropTypes.func,
  columns: PropTypes.arrayOf(columnType),
  savedMetricsOptions: PropTypes.arrayOf(savedMetricType),
  savedMetric: savedMetricType,
  datasource: PropTypes.object,
  onMoveLabel: PropTypes.func,
  onDropLabel: PropTypes.func,
  index: PropTypes.number,
  type: PropTypes.string,
  multi: PropTypes.bool,
  datasourceWarningMessage: PropTypes.string,
};

class AdhocMetricOption extends PureComponent {
  constructor(props: $TSFixMe) {
    super(props);
    this.onRemoveMetric = this.onRemoveMetric.bind(this);
  }

  onRemoveMetric(e: $TSFixMe) {
    e?.stopPropagation();
    // @ts-expect-error TS(2339): Property 'onRemoveMetric' does not exist on type '... Remove this comment to see the full error message
    this.props.onRemoveMetric(this.props.index);
  }

  render() {
    const {
      // @ts-expect-error TS(2339): Property 'adhocMetric' does not exist on type 'Rea... Remove this comment to see the full error message
      adhocMetric,
      // @ts-expect-error TS(2339): Property 'onMetricEdit' does not exist on type 'Re... Remove this comment to see the full error message
      onMetricEdit,
      // @ts-expect-error TS(2339): Property 'columns' does not exist on type 'Readonl... Remove this comment to see the full error message
      columns,
      // @ts-expect-error TS(2339): Property 'savedMetricsOptions' does not exist on t... Remove this comment to see the full error message
      savedMetricsOptions,
      // @ts-expect-error TS(2339): Property 'savedMetric' does not exist on type 'Rea... Remove this comment to see the full error message
      savedMetric,
      // @ts-expect-error TS(2339): Property 'datasource' does not exist on type 'Read... Remove this comment to see the full error message
      datasource,
      // @ts-expect-error TS(2339): Property 'onMoveLabel' does not exist on type 'Rea... Remove this comment to see the full error message
      onMoveLabel,
      // @ts-expect-error TS(2339): Property 'onDropLabel' does not exist on type 'Rea... Remove this comment to see the full error message
      onDropLabel,
      // @ts-expect-error TS(2339): Property 'index' does not exist on type 'Readonly<... Remove this comment to see the full error message
      index,
      // @ts-expect-error TS(2339): Property 'type' does not exist on type 'Readonly<{... Remove this comment to see the full error message
      type,
      // @ts-expect-error TS(2339): Property 'multi' does not exist on type 'Readonly<... Remove this comment to see the full error message
      multi,
      // @ts-expect-error TS(2339): Property 'datasourceWarningMessage' does not exist... Remove this comment to see the full error message
      datasourceWarningMessage,
    } = this.props;
    const withCaret = !savedMetric.error_text;

    return (
      <AdhocMetricPopoverTrigger
        adhocMetric={adhocMetric}
        onMetricEdit={onMetricEdit}
        columns={columns}
        savedMetricsOptions={savedMetricsOptions}
        savedMetric={savedMetric}
        datasource={datasource}
      >
        <OptionControlLabel
          savedMetric={savedMetric}
          adhocMetric={adhocMetric}
          label={adhocMetric.label}
          // @ts-expect-error TS(2322): Type '(e: any) => void' is not assignable to type ... Remove this comment to see the full error message
          onRemove={this.onRemoveMetric}
          onMoveLabel={onMoveLabel}
          onDropLabel={onDropLabel}
          index={index}
          type={type ?? DndItemType.AdhocMetricOption}
          withCaret={withCaret}
          isFunction
          multi={multi}
          datasourceWarningMessage={datasourceWarningMessage}
        />
      </AdhocMetricPopoverTrigger>
    );
  }
}

export default AdhocMetricOption;

// @ts-expect-error TS(2339): Property 'propTypes' does not exist on type 'typeo... Remove this comment to see the full error message
AdhocMetricOption.propTypes = propTypes;
