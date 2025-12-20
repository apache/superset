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
import { Metric } from '@superset-ui/core';
import { OptionControlLabel } from 'src/explore/components/controls/OptionControls';
import { DndItemType } from 'src/explore/components/DndItemType';
import { Datasource } from 'src/explore/types';
import { ISaveableDatasource } from 'src/SqlLab/components/SaveDatasetModal';
import columnType from './columnType';
import AdhocMetric from './AdhocMetric';
import savedMetricType from './savedMetricType';
import AdhocMetricPopoverTrigger from './AdhocMetricPopoverTrigger';
import { savedMetricType as SavedMetricTypeDef } from './types';

interface AdhocMetricOptionProps {
  adhocMetric: AdhocMetric;
  onMetricEdit: (newMetric: Metric, oldMetric: Metric) => void;
  onRemoveMetric?: (index: number) => void;
  columns?: { column_name: string; type: string }[];
  savedMetricsOptions?: SavedMetricTypeDef[];
  savedMetric: SavedMetricTypeDef;
  datasource?: Datasource & ISaveableDatasource;
  onMoveLabel?: (dragIndex: number, hoverIndex: number) => void;
  onDropLabel?: () => void;
  index?: number;
  type?: string;
  multi?: boolean;
  datasourceWarningMessage?: string;
}

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

class AdhocMetricOption extends PureComponent<AdhocMetricOptionProps> {
  constructor(props: AdhocMetricOptionProps) {
    super(props);
    this.onRemoveMetric = this.onRemoveMetric.bind(this);
  }

  onRemoveMetric(e?: React.MouseEvent): void {
    e?.stopPropagation();
    this.props.onRemoveMetric?.(this.props.index ?? 0);
  }

  render() {
    const {
      adhocMetric,
      onMetricEdit,
      columns,
      savedMetricsOptions,
      savedMetric,
      datasource,
      onMoveLabel,
      onDropLabel,
      index,
      type,
      multi,
      datasourceWarningMessage,
    } = this.props;
    const withCaret = !savedMetric.error_text;

    return (
      <AdhocMetricPopoverTrigger
        adhocMetric={adhocMetric}
        onMetricEdit={onMetricEdit}
        columns={columns ?? []}
        savedMetricsOptions={savedMetricsOptions ?? []}
        savedMetric={savedMetric}
        datasource={datasource!}
      >
        <OptionControlLabel
          savedMetric={savedMetric}
          adhocMetric={adhocMetric}
          label={adhocMetric.label}
          onRemove={() => this.onRemoveMetric()}
          onMoveLabel={onMoveLabel}
          onDropLabel={onDropLabel}
          index={index ?? 0}
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

// @ts-expect-error - propTypes are defined for runtime validation but TypeScript handles type checking
AdhocMetricOption.propTypes = propTypes;
