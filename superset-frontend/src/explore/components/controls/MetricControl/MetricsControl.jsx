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
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { ensureIsArray, t, useTheme } from '@superset-ui/core';
import ControlHeader from 'src/explore/components/ControlHeader';
import Icons from 'src/components/Icons';
import {
  AddIconButton,
  AddControlLabel,
  HeaderContainer,
  LabelsContainer,
} from 'src/explore/components/controls/OptionControls';
import columnType from './columnType';
import MetricDefinitionValue from './MetricDefinitionValue';
import AdhocMetric from './AdhocMetric';
import savedMetricType from './savedMetricType';
import adhocMetricType from './adhocMetricType';
import AdhocMetricPopoverTrigger from './AdhocMetricPopoverTrigger';

const propTypes = {
  name: PropTypes.string.isRequired,
  onChange: PropTypes.func,
  value: PropTypes.oneOfType([
    PropTypes.arrayOf(PropTypes.oneOfType([PropTypes.string, adhocMetricType])),
    PropTypes.oneOfType([PropTypes.string, adhocMetricType]),
  ]),
  columns: PropTypes.arrayOf(columnType),
  savedMetrics: PropTypes.arrayOf(savedMetricType),
  isLoading: PropTypes.bool,
  multi: PropTypes.bool,
  clearable: PropTypes.bool,
  datasourceType: PropTypes.string,
};

const defaultProps = {
  onChange: () => {},
  clearable: true,
  savedMetrics: [],
  columns: [],
};

function getOptionsForSavedMetrics(
  savedMetrics,
  currentMetricValues,
  currentMetric,
) {
  return (
    savedMetrics?.filter(savedMetric =>
      Array.isArray(currentMetricValues)
        ? !currentMetricValues.includes(savedMetric.metric_name) ||
          savedMetric.metric_name === currentMetric
        : savedMetric,
    ) ?? []
  );
}

function isDictionaryForAdhocMetric(value) {
  return value && !(value instanceof AdhocMetric) && value.expressionType;
}

function columnsContainAllMetrics(value, columns, savedMetrics) {
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
}

// adhoc metrics are stored as dictionaries in URL params. We convert them back into the
// AdhocMetric class for typechecking, consistency and instance method access.
function coerceAdhocMetrics(value) {
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
}

const emptySavedMetric = { metric_name: '', expression: '' };

const MetricsControl = ({
  onChange,
  multi,
  value: propsValue,
  columns,
  savedMetrics,
  datasource,
  datasourceType,
  ...props
}) => {
  const [value, setValue] = useState(coerceAdhocMetrics(propsValue));
  const theme = useTheme();

  const handleChange = useCallback(
    opts => {
      // if clear out options
      if (opts === null) {
        onChange(null);
        return;
      }

      const transformedOpts = ensureIsArray(opts);
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

  const onNewMetric = useCallback(
    newMetric => {
      const newValue = [...value, newMetric];
      setValue(newValue);
      handleChange(newValue);
    },
    [handleChange, value],
  );

  const onMetricEdit = useCallback(
    (changedMetric, oldMetric) => {
      const newValue = value.map(val => {
        if (
          // compare saved metrics
          val === oldMetric.metric_name ||
          // compare adhoc metrics
          typeof val.optionName !== 'undefined'
            ? val.optionName === oldMetric.optionName
            : false
        ) {
          return changedMetric;
        }
        return val;
      });
      setValue(newValue);
      handleChange(newValue);
    },
    [handleChange, value],
  );

  const onRemoveMetric = useCallback(
    index => {
      if (!Array.isArray(value)) {
        return;
      }
      const valuesCopy = [...value];
      valuesCopy.splice(index, 1);
      setValue(valuesCopy);
      handleChange(valuesCopy);
    },
    [handleChange, value],
  );

  const moveLabel = useCallback(
    (dragIndex, hoverIndex) => {
      const newValues = [...value];
      [newValues[hoverIndex], newValues[dragIndex]] = [
        newValues[dragIndex],
        newValues[hoverIndex],
      ];
      setValue(newValues);
    },
    [value],
  );

  const isAddNewMetricDisabled = useCallback(() => !multi && value.length > 0, [
    multi,
    value.length,
  ]);

  const savedMetricOptions = useMemo(
    () => getOptionsForSavedMetrics(savedMetrics, propsValue, null),
    [propsValue, savedMetrics],
  );

  const newAdhocMetric = useMemo(() => new AdhocMetric({ isNew: true }), [
    value,
  ]);
  const addNewMetricPopoverTrigger = useCallback(
    trigger => {
      if (isAddNewMetricDisabled()) {
        return trigger;
      }
      return (
        <AdhocMetricPopoverTrigger
          adhocMetric={newAdhocMetric}
          onMetricEdit={onNewMetric}
          columns={columns}
          savedMetricsOptions={savedMetricOptions}
          datasource={datasource}
          savedMetric={emptySavedMetric}
          datasourceType={datasourceType}
        >
          {trigger}
        </AdhocMetricPopoverTrigger>
      );
    },
    [
      columns,
      datasource,
      datasourceType,
      isAddNewMetricDisabled,
      newAdhocMetric,
      onNewMetric,
      savedMetricOptions,
    ],
  );

  useEffect(() => {
    // Remove all metrics if selected value no longer a valid column
    // in the dataset. Must use `nextProps` here because Redux reducers may
    // have already updated the value for this control.
    if (!columnsContainAllMetrics(propsValue, columns, savedMetrics)) {
      handleChange([]);
    }
  }, [columns, savedMetrics]);

  useEffect(() => {
    setValue(coerceAdhocMetrics(propsValue));
  }, [propsValue]);

  const onDropLabel = useCallback(() => handleChange(value), [
    handleChange,
    value,
  ]);

  const valueRenderer = useCallback(
    (option, index) => (
      <MetricDefinitionValue
        key={index}
        index={index}
        option={option}
        onMetricEdit={onMetricEdit}
        onRemoveMetric={onRemoveMetric}
        columns={columns}
        datasource={datasource}
        savedMetrics={savedMetrics}
        savedMetricsOptions={getOptionsForSavedMetrics(
          savedMetrics,
          value,
          value?.[index],
        )}
        datasourceType={datasourceType}
        onMoveLabel={moveLabel}
        onDropLabel={onDropLabel}
        multi={multi}
      />
    ),
    [
      columns,
      datasource,
      datasourceType,
      moveLabel,
      multi,
      onDropLabel,
      onMetricEdit,
      onRemoveMetric,
      savedMetrics,
      value,
    ],
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
            <Icons.PlusLarge
              iconSize="s"
              iconColor={theme.colors.grayscale.light5}
            />
          </AddIconButton>,
        )}
      </HeaderContainer>
      <LabelsContainer>
        {value.length > 0
          ? value.map((value, index) => valueRenderer(value, index))
          : addNewMetricPopoverTrigger(
              <AddControlLabel>
                <Icons.PlusSmall iconColor={theme.colors.grayscale.light1} />
                {t('Add metric')}
              </AddControlLabel>,
            )}
      </LabelsContainer>
    </div>
  );
};

MetricsControl.propTypes = propTypes;
MetricsControl.defaultProps = defaultProps;

export default MetricsControl;
