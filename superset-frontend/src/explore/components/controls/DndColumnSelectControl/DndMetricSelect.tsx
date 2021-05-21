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
import { ensureIsArray, Metric, tn } from '@superset-ui/core';
import { ColumnMeta } from '@superset-ui/chart-controls';
import { isEqual } from 'lodash';
import { usePrevious } from 'src/common/hooks/usePrevious';
import AdhocMetric from 'src/explore/components/controls/MetricControl/AdhocMetric';
import AdhocMetricPopoverTrigger from 'src/explore/components/controls/MetricControl/AdhocMetricPopoverTrigger';
import MetricDefinitionValue from 'src/explore/components/controls/MetricControl/MetricDefinitionValue';
import { OptionValueType } from 'src/explore/components/controls/DndColumnSelectControl/types';
import { DatasourcePanelDndItem } from 'src/explore/components/DatasourcePanel/types';
import { DndItemType } from 'src/explore/components/DndItemType';
import DndSelectLabel from 'src/explore/components/controls/DndColumnSelectControl/DndSelectLabel';
import { savedMetricType } from 'src/explore/components/controls/MetricControl/types';

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

const columnsContainAllMetrics = (
  value: (string | AdhocMetric | ColumnMeta)[],
  columns: ColumnMeta[],
  savedMetrics: savedMetricType[],
) => {
  const columnNames = new Set(
    [...(columns || []), ...(savedMetrics || [])]
      // eslint-disable-next-line camelcase
      .map(
        item =>
          (item as ColumnMeta).column_name ||
          (item as savedMetricType).metric_name,
      ),
  );

  return (
    ensureIsArray(value)
      .filter(metric => metric)
      // find column names
      .map(metric =>
        (metric as AdhocMetric).column
          ? (metric as AdhocMetric).column.column_name
          : (metric as ColumnMeta).column_name || metric,
      )
      .filter(name => name && typeof name === 'string')
      .every(name => columnNames.has(name))
  );
};

export const DndMetricSelect = (props: any) => {
  const { onChange, multi, columns, savedMetrics } = props;

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

  const [value, setValue] = useState<(AdhocMetric | Metric | string)[]>(
    coerceAdhocMetrics(props.value),
  );
  const [droppedItem, setDroppedItem] = useState<DatasourcePanelDndItem | null>(
    null,
  );
  const [newMetricPopoverVisible, setNewMetricPopoverVisible] = useState(false);
  const prevColumns = usePrevious(columns);
  const prevSavedMetrics = usePrevious(savedMetrics);

  useEffect(() => {
    setValue(coerceAdhocMetrics(props.value));
  }, [JSON.stringify(props.value)]);

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
  }, [
    prevColumns,
    columns,
    prevSavedMetrics,
    savedMetrics,
    props.value,
    onChange,
  ]);

  const canDrop = (item: DatasourcePanelDndItem) => {
    const isMetricAlreadyInValues =
      item.type === 'metric' ? value.includes(item.value.metric_name) : false;
    return (props.multi || value.length === 0) && !isMetricAlreadyInValues;
  };

  const onNewMetric = (newMetric: Metric) => {
    const newValue = [...value, newMetric];
    setValue(newValue);
    handleChange(newValue);
  };

  const onMetricEdit = (
    changedMetric: Metric | AdhocMetric,
    oldMetric: Metric | AdhocMetric,
  ) => {
    const newValue = value.map(value => {
      if (
        // compare saved metrics
        value === (oldMetric as Metric).metric_name ||
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
  };

  const onRemoveMetric = (index: number) => {
    if (!Array.isArray(value)) {
      return;
    }
    const valuesCopy = [...value];
    valuesCopy.splice(index, 1);
    setValue(valuesCopy);
    onChange(valuesCopy);
  };

  const moveLabel = (dragIndex: number, hoverIndex: number) => {
    const newValues = [...value];
    [newValues[hoverIndex], newValues[dragIndex]] = [
      newValues[dragIndex],
      newValues[hoverIndex],
    ];
    setValue(newValues);
  };

  const valueRenderer = (
    option: Metric | AdhocMetric | string,
    index: number,
  ) => (
    <MetricDefinitionValue
      key={index}
      index={index}
      option={option}
      onMetricEdit={onMetricEdit}
      onRemoveMetric={() => onRemoveMetric(index)}
      columns={props.columns}
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

  const valuesRenderer = () =>
    value.map((value, index) => valueRenderer(value, index));

  const togglePopover = (visible: boolean) => {
    setNewMetricPopoverVisible(visible);
  };

  const closePopover = () => {
    togglePopover(false);
  };

  const handleDrop = (item: DatasourcePanelDndItem) => {
    if (item.type === DndItemType.Metric) {
      onNewMetric(item.value as Metric);
    }
    if (item.type === DndItemType.Column) {
      setDroppedItem(item);
      togglePopover(true);
    }
  };

  const adhocMetric = useMemo(() => {
    if (droppedItem?.type === DndItemType.Column) {
      const itemValue = droppedItem?.value as ColumnMeta;
      return new AdhocMetric({
        column: { column_name: itemValue?.column_name },
      });
    }
    return new AdhocMetric({ isNew: true });
  }, [droppedItem?.type, droppedItem?.value]);

  return (
    <div className="metrics-select">
      <DndSelectLabel<OptionValueType, OptionValueType[]>
        onDrop={handleDrop}
        canDrop={canDrop}
        valuesRenderer={valuesRenderer}
        accept={[DndItemType.Column, DndItemType.Metric]}
        ghostButtonText={tn(
          'Drop column or metric',
          'Drop columns or metrics',
          multi ? 2 : 1,
        )}
        displayGhostButton={multi || value.length === 0}
        {...props}
      />
      <AdhocMetricPopoverTrigger
        adhocMetric={adhocMetric}
        onMetricEdit={onNewMetric}
        columns={props.columns}
        savedMetricsOptions={getOptionsForSavedMetrics(
          props.savedMetrics,
          props.value,
        )}
        savedMetric={{} as savedMetricType}
        datasourceType={props.datasourceType}
        isControlledComponent
        visible={newMetricPopoverVisible}
        togglePopover={togglePopover}
        closePopover={closePopover}
        createNew
      >
        <div />
      </AdhocMetricPopoverTrigger>
    </div>
  );
};
