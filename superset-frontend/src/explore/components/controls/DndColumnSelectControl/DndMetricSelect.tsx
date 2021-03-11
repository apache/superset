/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with work for additional information
 * regarding copyright ownership.  The ASF licenses file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use file except in compliance
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

import React, { useCallback, useEffect, useState } from 'react';
import { ensureIsArray, t, useTheme } from '@superset-ui/core';
import { isEqual } from 'lodash';
import Icon from 'src/components/Icon';
import AdhocMetric from '../MetricControl/AdhocMetric';
import AdhocMetricPopoverTrigger from '../MetricControl/AdhocMetricPopoverTrigger';
import ControlHeader from '../../ControlHeader';
import {
  AddControlLabel,
  AddIconButton,
  HeaderContainer,
  LabelsContainer,
} from '../../OptionControls';
import MetricDefinitionValue from '../MetricControl/MetricDefinitionValue';
import { usePrevious } from '../../../../common/hooks/usePrevious';

const isDictionaryForAdhocMetric = (value: any) =>
  value && !(value instanceof AdhocMetric) && value.expressionType;

const coerceAdhocMetrics = (value: any) => {
  if (!value) {
    return [];
  }
  if (!Array.isArray(value)) {
    if (isDictionaryForAdhocMetric(value)) {
      return [new AdhocMetric(value)];
    }
    return [value];
  }
  return value.map(val => {
    if (isDictionaryForAdhocMetric(val)) {
      return new AdhocMetric(val);
    }
    return val;
  });
};

const getOptionsForSavedMetrics = (
  savedMetrics,
  currentMetricValues,
  currentMetric,
) =>
  savedMetrics?.filter(savedMetric =>
    Array.isArray(currentMetricValues)
      ? !currentMetricValues.includes(savedMetric.metric_name) ||
        savedMetric.metric_name === currentMetric
      : savedMetric,
  ) ?? [];

const columnsContainAllMetrics = (value, columns, savedMetrics) => {
  const columnNames = new Set(
    [...(columns || []), ...(savedMetrics || [])]
      // eslint-disable-next-line camelcase
      .map(({ column_name, metric_name }) => column_name || metric_name),
  );

  return (
    (Array.isArray(value) ? value : [value])
      .filter(metric => metric)
      // find column names
      .map(metric =>
        metric.column
          ? metric.column.column_name
          : metric.column_name || metric,
      )
      .filter(name => name && typeof name === 'string')
      .every(name => columnNames.has(name))
  );
};

const areMetricsEqual = (metric1, metric2) => {
  if (typeof metric1 !== typeof metric2) {
    return false;
  }
  if (typeof metric1 === 'string') {
    return metric1 === metric2;
  }
  if (typeof metric1 === 'object' && metric1 instanceof AdhocMetric) {
    return metric1.equals(metric2);
  }
  return isEqual(metric1, metric2);
};

const areMetricsArraysEqual = (metrics1, metrics2) => {
  const metricsArr1 = ensureIsArray(metrics1);
  const metricsArr2 = ensureIsArray(metrics2);
  return (
    metricsArr1.length === metricsArr2.length &&
    metricsArr1.every((el: any, index: number) =>
      areMetricsEqual(metricsArr1[index], metricsArr2[index]),
    )
  );
};

export const DndMetricSelect = props => {
  const { onChange, multi, columns, savedMetrics } = props;

  const handleChange = useCallback(
    opts => {
      // if clear out options
      if (opts === null) {
        onChange(null);
        return;
      }

      let transformedOpts;
      if (Array.isArray(opts)) {
        transformedOpts = opts;
      } else {
        transformedOpts = opts ? [opts] : [];
      }
      const optionValues = transformedOpts
        .map(option => {
          // pre-defined metric
          if (option.metric_name) {
            return option.metric_name;
          }
          return option;
        })
        .filter(option => option);
      onChange(multi ? optionValues : optionValues[0]);
    },
    [multi, onChange],
  );

  const theme = useTheme();
  const [value, setValue] = useState(coerceAdhocMetrics(props.value));
  const prevColumns = usePrevious(columns);
  const prevSavedMetrics = usePrevious(savedMetrics);
  const prevValue = usePrevious(props.value);

  useEffect(() => {
    handleChange(value);
  }, [handleChange, value]);

  useEffect(() => {
    if (
      !isEqual(prevColumns, columns) ||
      !isEqual(prevSavedMetrics, savedMetrics)
    ) {
      // Remove all metrics if selected value no longer a valid column
      // in the dataset. Must use `nextProps` here because Redux reducers may
      // have already updated the value for this control.
      if (!columnsContainAllMetrics(props.value, columns, savedMetrics)) {
        onChange([]);
      }
    }
    if (!areMetricsArraysEqual(prevValue, props.value)) {
      setValue(coerceAdhocMetrics(props.value));
    }
  }, [
    prevColumns,
    columns,
    prevSavedMetrics,
    savedMetrics,
    prevValue,
    props.value,
    onChange,
  ]);

  const isAddNewMetricDisabled = () => !props.multi && value.length > 0;

  const onNewMetric = newMetric => {
    setValue(prevValue => [...prevValue, newMetric]);
  };

  const onMetricEdit = (changedMetric, oldMetric) => {
    setValue(prevValue =>
      prevValue.map(value => {
        if (
          // compare saved metrics
          value === oldMetric.metric_name ||
          // compare adhoc metrics
          typeof value.optionName !== 'undefined'
            ? value.optionName === oldMetric.optionName
            : false
        ) {
          return changedMetric;
        }
        return value;
      }),
    );
  };

  const onRemoveMetric = (index: number) => {
    if (!Array.isArray(value)) {
      return;
    }
    const valuesCopy = [...value];
    valuesCopy.splice(index, 1);
    setValue(valuesCopy);
  };

  const addNewMetricPopoverTrigger = trigger => {
    if (isAddNewMetricDisabled()) {
      return trigger;
    }
    return (
      <AdhocMetricPopoverTrigger
        adhocMetric={new AdhocMetric({ isNew: true })}
        onMetricEdit={onNewMetric}
        columns={props.columns}
        savedMetricsOptions={getOptionsForSavedMetrics(
          props.savedMetrics,
          props.value,
          null,
        )}
        datasource={props.datasource}
        savedMetric={{}}
        datasourceType={props.datasourceType}
        createNew
      >
        {trigger}
      </AdhocMetricPopoverTrigger>
    );
  };

  const moveLabel = (dragIndex, hoverIndex) => {
    const newValues = [...value];
    [newValues[hoverIndex], newValues[dragIndex]] = [
      newValues[dragIndex],
      newValues[hoverIndex],
    ];
    setValue(newValues);
  };

  const valueRenderer = (option, index) => (
    <MetricDefinitionValue
      key={index}
      index={index}
      option={option}
      onMetricEdit={onMetricEdit}
      onRemoveMetric={() => onRemoveMetric(index)}
      columns={props.columns}
      datasource={props.datasource}
      savedMetrics={props.savedMetrics}
      savedMetricsOptions={getOptionsForSavedMetrics(
        props.savedMetrics,
        props.value,
        props.value?.[index],
      )}
      datasourceType={props.datasourceType}
      onMoveLabel={moveLabel}
      onDropLabel={() => onChange(value)}
    />
  );

  return (
    <div className="metrics-select">
      <HeaderContainer>
        <ControlHeader {...props} />
        {addNewMetricPopoverTrigger(
          <AddIconButton
            disabled={isAddNewMetricDisabled()}
            data-test="add-metric-button"
          >
            <Icon
              name="plus-large"
              width={theme.gridUnit * 3}
              height={theme.gridUnit * 3}
              color={theme.colors.grayscale.light5}
            />
          </AddIconButton>,
        )}
      </HeaderContainer>
      <LabelsContainer>
        {value.length > 0
          ? value.map((value, index) => valueRenderer(value, index))
          : addNewMetricPopoverTrigger(
              <AddControlLabel>
                <Icon name="plus-small" color={theme.colors.grayscale.light1} />
                {t('Add metric')}
              </AddControlLabel>,
            )}
      </LabelsContainer>
    </div>
  );
};
