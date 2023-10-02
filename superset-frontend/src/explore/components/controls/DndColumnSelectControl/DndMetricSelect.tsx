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

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ensureIsArray,
  GenericDataType,
  isAdhocMetricSimple,
  isSavedMetric,
  Metric,
  QueryFormMetric,
  t,
  tn,
} from '@superset-ui/core';
import { ColumnMeta, withDndFallback } from '@superset-ui/chart-controls';
import AdhocMetric from 'src/explore/components/controls/MetricControl/AdhocMetric';
import AdhocMetricPopoverTrigger from 'src/explore/components/controls/MetricControl/AdhocMetricPopoverTrigger';
import MetricDefinitionValue from 'src/explore/components/controls/MetricControl/MetricDefinitionValue';
import {
  DatasourcePanelDndItem,
  isDatasourcePanelDndItem,
} from 'src/explore/components/DatasourcePanel/types';
import { DndItemType } from 'src/explore/components/DndItemType';
import DndSelectLabel from 'src/explore/components/controls/DndColumnSelectControl/DndSelectLabel';
import { savedMetricType } from 'src/explore/components/controls/MetricControl/types';
import { AGGREGATES } from 'src/explore/constants';
import MetricsControl from '../MetricControl/MetricsControl';

const EMPTY_OBJECT = {};
const DND_ACCEPTED_TYPES = [DndItemType.Column, DndItemType.Metric];

const isDictionaryForAdhocMetric = (value: QueryFormMetric) =>
  value &&
  !(value instanceof AdhocMetric) &&
  typeof value !== 'string' &&
  value.expressionType;

const coerceMetrics = (
  addedMetrics: QueryFormMetric | QueryFormMetric[] | undefined | null,
  savedMetrics: Metric[],
  columns: ColumnMeta[],
) => {
  if (!addedMetrics) {
    return [];
  }
  const metricsCompatibleWithDataset = ensureIsArray(addedMetrics).filter(
    metric => {
      if (isSavedMetric(metric)) {
        return savedMetrics.some(
          savedMetric => savedMetric.metric_name === metric,
        );
      }
      if (isAdhocMetricSimple(metric)) {
        return columns.some(
          column => column.column_name === metric.column.column_name,
        );
      }
      return true;
    },
  );

  return metricsCompatibleWithDataset.map(metric => {
    if (!isDictionaryForAdhocMetric(metric)) {
      return metric;
    }
    if (isAdhocMetricSimple(metric)) {
      const column = columns.find(
        col => col.column_name === metric.column.column_name,
      );
      if (column) {
        return new AdhocMetric({ ...metric, column });
      }
    }
    return new AdhocMetric(metric);
  });
};

const getOptionsForSavedMetrics = (
  savedMetrics: savedMetricType[],
  currentMetricValues: (string | AdhocMetric)[],
  currentMetric?: string,
) =>
  savedMetrics?.filter(savedMetric =>
    Array.isArray(currentMetricValues)
      ? !currentMetricValues.includes(savedMetric.metric_name ?? '') ||
        savedMetric.metric_name === currentMetric
      : savedMetric,
  ) ?? [];

type ValueType = Metric | AdhocMetric | QueryFormMetric;

const DndMetricSelect = (props: any) => {
  const { onChange, multi } = props;

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

  const [value, setValue] = useState<ValueType[]>(
    coerceMetrics(props.value, props.savedMetrics, props.columns),
  );
  const [droppedItem, setDroppedItem] = useState<
    DatasourcePanelDndItem | typeof EMPTY_OBJECT
  >({});
  const [newMetricPopoverVisible, setNewMetricPopoverVisible] = useState(false);

  useEffect(() => {
    setValue(coerceMetrics(props.value, props.savedMetrics, props.columns));
  }, [
    JSON.stringify(props.value),
    JSON.stringify(props.savedMetrics),
    JSON.stringify(props.columns),
  ]);

  const canDrop = useCallback(
    (item: DatasourcePanelDndItem) => {
      const isMetricAlreadyInValues =
        item.type === 'metric' ? value.includes(item.value.metric_name) : false;
      return !isMetricAlreadyInValues;
    },
    [value],
  );

  const onNewMetric = useCallback(
    (newMetric: Metric) => {
      const newValue = props.multi ? [...value, newMetric] : [newMetric];
      setValue(newValue);
      handleChange(newValue);
    },
    [handleChange, props.multi, value],
  );

  const onMetricEdit = useCallback(
    (changedMetric: Metric | AdhocMetric, oldMetric: Metric | AdhocMetric) => {
      if (oldMetric instanceof AdhocMetric && oldMetric.equals(changedMetric)) {
        return;
      }
      const newValue = value.map(value => {
        if (
          // compare saved metrics
          ('metric_name' in oldMetric && value === oldMetric.metric_name) ||
          // compare adhoc metrics
          typeof (value as AdhocMetric).optionName !== 'undefined'
            ? (value as AdhocMetric).optionName ===
              (oldMetric as AdhocMetric).optionName
            : false
        ) {
          return changedMetric;
        }
        return value;
      });
      setValue(newValue);
      handleChange(newValue);
    },
    [handleChange, value],
  );

  const onRemoveMetric = useCallback(
    (index: number) => {
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
    (dragIndex: number, hoverIndex: number) => {
      const newValues = [...value];
      [newValues[hoverIndex], newValues[dragIndex]] = [
        newValues[dragIndex],
        newValues[hoverIndex],
      ];
      setValue(newValues);
    },
    [value],
  );

  const newSavedMetricOptions = useMemo(
    () => getOptionsForSavedMetrics(props.savedMetrics, props.value),
    [props.savedMetrics, props.value],
  );

  const getSavedMetricOptionsForMetric = useCallback(
    index =>
      getOptionsForSavedMetrics(
        props.savedMetrics,
        props.value,
        props.value?.[index],
      ),
    [props.savedMetrics, props.value],
  );

  const handleDropLabel = useCallback(
    () => onChange(multi ? value : value[0]),
    [multi, onChange, value],
  );

  const valueRenderer = useCallback(
    (option: ValueType, index: number) => (
      <MetricDefinitionValue
        key={index}
        index={index}
        option={option}
        onMetricEdit={onMetricEdit}
        onRemoveMetric={onRemoveMetric}
        columns={props.columns}
        savedMetrics={props.savedMetrics}
        savedMetricsOptions={getSavedMetricOptionsForMetric(index)}
        datasource={props.datasource}
        onMoveLabel={moveLabel}
        onDropLabel={handleDropLabel}
        type={`${DndItemType.AdhocMetricOption}_${props.name}_${props.label}`}
        multi={multi}
        datasourceWarningMessage={
          option instanceof AdhocMetric && option.datasourceWarning
            ? t('This metric might be incompatible with current dataset')
            : undefined
        }
      />
    ),
    [
      getSavedMetricOptionsForMetric,
      handleDropLabel,
      moveLabel,
      multi,
      onMetricEdit,
      onRemoveMetric,
      props.columns,
      props.datasource,
      props.label,
      props.name,
      props.savedMetrics,
    ],
  );

  const valuesRenderer = useCallback(
    () => value.map((value, index) => valueRenderer(value, index)),
    [value, valueRenderer],
  );

  const togglePopover = useCallback((visible: boolean) => {
    setNewMetricPopoverVisible(visible);
  }, []);

  const closePopover = useCallback(() => {
    togglePopover(false);
  }, [togglePopover]);

  const handleDrop = useCallback(
    (item: DatasourcePanelDndItem) => {
      if (item.type === DndItemType.Metric) {
        onNewMetric(item.value as Metric);
      }
      if (item.type === DndItemType.Column) {
        setDroppedItem(item);
        togglePopover(true);
      }
    },
    [onNewMetric, togglePopover],
  );

  const handleClickGhostButton = useCallback(() => {
    setDroppedItem({});
    togglePopover(true);
  }, [togglePopover]);

  const adhocMetric = useMemo(() => {
    if (
      isDatasourcePanelDndItem(droppedItem) &&
      droppedItem.type === DndItemType.Column
    ) {
      const itemValue = droppedItem.value as ColumnMeta;
      const config: Partial<AdhocMetric> = {
        column: itemValue,
      };
      if (itemValue.type_generic === GenericDataType.NUMERIC) {
        config.aggregate = AGGREGATES.SUM;
      } else if (
        itemValue.type_generic === GenericDataType.STRING ||
        itemValue.type_generic === GenericDataType.BOOLEAN ||
        itemValue.type_generic === GenericDataType.TEMPORAL
      ) {
        config.aggregate = AGGREGATES.COUNT_DISTINCT;
      }
      return new AdhocMetric(config);
    }
    return new AdhocMetric({});
  }, [droppedItem]);

  const ghostButtonText = tn(
    'Drop a column/metric here or click',
    'Drop columns/metrics here or click',
    multi ? 2 : 1,
  );

  return (
    <div className="metrics-select">
      <DndSelectLabel
        onDrop={handleDrop}
        canDrop={canDrop}
        valuesRenderer={valuesRenderer}
        accept={DND_ACCEPTED_TYPES}
        ghostButtonText={ghostButtonText}
        displayGhostButton={multi || value.length === 0}
        onClickGhostButton={handleClickGhostButton}
        {...props}
      />
      <AdhocMetricPopoverTrigger
        adhocMetric={adhocMetric}
        onMetricEdit={onNewMetric}
        columns={props.columns}
        savedMetricsOptions={newSavedMetricOptions}
        savedMetric={EMPTY_OBJECT as savedMetricType}
        datasource={props.datasource}
        isControlledComponent
        visible={newMetricPopoverVisible}
        togglePopover={togglePopover}
        closePopover={closePopover}
        isNew
      >
        <div />
      </AdhocMetricPopoverTrigger>
    </div>
  );
};

const DndMetricSelectWithFallback = withDndFallback(
  DndMetricSelect,
  MetricsControl,
);

export { DndMetricSelectWithFallback as DndMetricSelect };
