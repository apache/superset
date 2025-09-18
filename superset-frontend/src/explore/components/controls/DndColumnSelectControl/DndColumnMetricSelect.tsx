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
import { useCallback, useMemo, useState } from 'react';
import {
  AdhocColumn,
  tn,
  t,
  isAdhocColumn,
  Metric,
  ensureIsArray,
  Datasource,
  QueryFormMetric,
  QueryFormData,
} from '@superset-ui/core';
import { ColumnMeta, isColumnMeta } from '@superset-ui/chart-controls';
import { isString } from 'lodash';
import DndSelectLabel from 'src/explore/components/controls/DndColumnSelectControl/DndSelectLabel';
import OptionWrapper from 'src/explore/components/controls/DndColumnSelectControl/OptionWrapper';
import { DatasourcePanelDndItem } from 'src/explore/components/DatasourcePanel/types';
import { DndItemType } from 'src/explore/components/DndItemType';
import AdhocMetric from 'src/explore/components/controls/MetricControl/AdhocMetric';
import MetricDefinitionValue from 'src/explore/components/controls/MetricControl/MetricDefinitionValue';
import ColumnSelectPopoverTrigger from './ColumnSelectPopoverTrigger';
import { DndControlProps } from './types';

const AGGREGATED_DECK_GL_CHART_TYPES = [
  'deck_screengrid',
  'deck_heatmap',
  'deck_contour',
  'deck_hex',
  'deck_grid',
];

const MULTI_VALUE_WARNING_MESSAGE =
  'This metric or column contains many values, they may not be able to be all displayed in the tooltip';

interface TooltipItem {
  item_type?: string;
  column_name?: string;
  metric_name?: string;
  label?: string;
}

function isAggregatedDeckGLChart(vizType: string): boolean {
  return AGGREGATED_DECK_GL_CHART_TYPES.includes(vizType);
}

function fieldHasMultipleValues(
  item: TooltipItem | string,
  formData: QueryFormData,
): boolean {
  if (!formData?.viz_type || !isAggregatedDeckGLChart(formData.viz_type)) {
    return false;
  }

  if (typeof item === 'string') {
    return true;
  }

  if (item.item_type === 'metric') {
    return false;
  }

  if (item.item_type === 'column') {
    return true;
  }

  return false;
}

const DND_ACCEPTED_TYPES = [DndItemType.Column, DndItemType.Metric];

type ColumnMetricValue =
  | string
  | AdhocColumn
  | AdhocMetric
  | { metric_name: string; error_text: string; uuid: string };

export type DndColumnMetricSelectProps = DndControlProps<ColumnMetricValue> & {
  columns: ColumnMeta[];
  savedMetrics: Metric[];
  datasource?: Datasource;
  selectedMetrics?: QueryFormMetric[];
  isTemporal?: boolean;
  disabledTabs?: Set<string>;
  formData?: any;
};

const isDictionaryForAdhocMetric = (
  value: unknown,
): value is Record<string, unknown> =>
  value !== null &&
  value !== undefined &&
  !(value instanceof AdhocMetric) &&
  typeof value === 'object' &&
  'expressionType' in value;

function DndColumnMetricSelect(props: DndColumnMetricSelectProps) {
  const {
    value,
    columns = [],
    savedMetrics = [],
    selectedMetrics = [],
    datasource,
    multi = true,
    onChange,
    canDelete = true,
    ghostButtonText,
    name,
    label,
    isTemporal,
    disabledTabs,
    formData,
  } = props;

  const [newColumnPopoverVisible, setNewColumnPopoverVisible] = useState(false);

  const combinedOptionsMap = useMemo(() => {
    const optionsMap: Record<string, ColumnMeta> = {};

    columns.forEach(column => {
      optionsMap[column.column_name] = column;
    });

    return optionsMap;
  }, [columns]);

  const isMetricSelected = useCallback(
    (metricName: string) => {
      if (!selectedMetrics || selectedMetrics.length === 0) {
        return false;
      }

      return selectedMetrics.some(metric => {
        if (isString(metric)) {
          return metric === metricName;
        }
        if (metric instanceof AdhocMetric) {
          return metric.label === metricName;
        }
        if (metric && typeof metric === 'object') {
          if (metric instanceof AdhocMetric) {
            return metric.label === metricName;
          }
          return 'metric_name' in metric && metric.metric_name === metricName;
        }
        return false;
      });
    },
    [selectedMetrics],
  );

  const coercedValue = useMemo(() => {
    if (!value) return [];

    const valueArray = ensureIsArray(value);
    return valueArray.map(item => {
      if (isString(item) && combinedOptionsMap[item]) {
        return item;
      }

      if (isString(item) && savedMetrics.some(m => m.metric_name === item)) {
        return item;
      }

      if (isAdhocColumn(item)) {
        return item;
      }

      if (isDictionaryForAdhocMetric(item)) {
        return new AdhocMetric(item);
      }

      if (item instanceof AdhocMetric) {
        return item;
      }

      return item;
    });
  }, [value, combinedOptionsMap, savedMetrics]);

  const onDrop = useCallback(
    (item: DatasourcePanelDndItem) => {
      const newValues = [...coercedValue];

      if (item.type === DndItemType.Column) {
        const column = item.value as ColumnMeta;

        if (!multi && newValues.length > 0) {
          newValues[0] = column.column_name;
        } else {
          newValues.push(column.column_name);
        }
      }
      if (item.type === DndItemType.Metric) {
        const metric = item.value as Metric;

        if (!multi && newValues.length > 0) {
          newValues[0] = metric.metric_name;
        } else {
          newValues.push(metric.metric_name);
        }
      }

      onChange(multi ? newValues : newValues[0]);
    },
    [onChange, coercedValue, multi],
  );

  const canDrop = useCallback(
    (item: DatasourcePanelDndItem) => {
      if (item.type === DndItemType.Column) {
        const columnName = (item.value as ColumnMeta).column_name;
        return (
          columnName in combinedOptionsMap &&
          !coercedValue.some(v => v === columnName)
        );
      }
      if (item.type === DndItemType.Metric) {
        const metric = item.value as Metric;
        const metricName = metric.metric_name;

        return (
          isMetricSelected(metricName) &&
          !coercedValue.some(v => v === metricName)
        );
      }
      return false;
    },
    [combinedOptionsMap, coercedValue, isMetricSelected],
  );

  const onClickClose = useCallback(
    (index: number) => {
      const newValues = [...coercedValue];
      newValues.splice(index, 1);
      onChange(multi ? newValues : newValues[0]);
    },
    [onChange, coercedValue, multi],
  );

  const onShiftOptions = useCallback(
    (dragIndex: number, hoverIndex: number) => {
      const newValues = [...coercedValue];
      [newValues[hoverIndex], newValues[dragIndex]] = [
        newValues[dragIndex],
        newValues[hoverIndex],
      ];
      onChange(multi ? newValues : newValues[0]);
    },
    [onChange, coercedValue, multi],
  );

  const isColumnValue = (val: unknown): val is string =>
    isString(val) && !!combinedOptionsMap[val];

  const valuesRenderer = useCallback(
    () =>
      coercedValue.map((item, idx) => {
        if (isColumnValue(item)) {
          const column = combinedOptionsMap[item];
          const datasourceWarningMessage = undefined;
          const withCaret = true;

          const columnItem = {
            item_type: 'column',
            column_name: item,
          };
          const hasMultipleValues =
            formData && fieldHasMultipleValues(columnItem, formData);
          const multiValueWarningMessage = hasMultipleValues
            ? MULTI_VALUE_WARNING_MESSAGE
            : undefined;

          return (
            <ColumnSelectPopoverTrigger
              key={`column-${idx}`}
              columns={columns}
              onColumnEdit={newColumn => {
                const newValues = [...coercedValue];
                if (isColumnMeta(newColumn)) {
                  newValues[idx] = newColumn.column_name;
                } else {
                  newValues[idx] = newColumn;
                }
                onChange(multi ? newValues : newValues[0]);
              }}
              editedColumn={column}
              isTemporal={isTemporal}
              disabledTabs={disabledTabs}
            >
              <OptionWrapper
                key={`column-${idx}`}
                index={idx}
                clickClose={onClickClose}
                onShiftOptions={onShiftOptions}
                type={`${DndItemType.ColumnOption}_${name}_${label}`}
                canDelete={canDelete}
                column={column}
                datasourceWarningMessage={datasourceWarningMessage}
                withCaret={withCaret}
                multiValueWarningMessage={multiValueWarningMessage}
              />
            </ColumnSelectPopoverTrigger>
          );
        }
        const datasourceWarningMessage =
          (item instanceof AdhocMetric && item.datasourceWarning) ||
          (item &&
            typeof item === 'object' &&
            'error_text' in item &&
            item.error_text)
            ? t('This metric might be incompatible with current dataset')
            : undefined;

        return (
          <MetricDefinitionValue
            key={`metric-${idx}`}
            index={idx}
            option={item}
            onMetricEdit={(changedMetric: Metric | AdhocMetric) => {
              const newValues = [...coercedValue];
              if (changedMetric instanceof AdhocMetric) {
                newValues[idx] = changedMetric;
              } else {
                newValues[idx] = (changedMetric as Metric).metric_name;
              }
              onChange(multi ? newValues : newValues[0]);
            }}
            onRemoveMetric={onClickClose}
            columns={columns}
            savedMetrics={savedMetrics}
            savedMetricsOptions={savedMetrics}
            datasource={datasource}
            onMoveLabel={onShiftOptions}
            onDropLabel={() => {}}
            type={`${DndItemType.AdhocMetricOption}_${name}_${label}`}
            multi={multi}
            datasourceWarningMessage={datasourceWarningMessage}
          />
        );
      }),
    [
      coercedValue,
      isColumnValue,
      combinedOptionsMap,
      columns,
      onChange,
      multi,
      isTemporal,
      disabledTabs,
      onClickClose,
      onShiftOptions,
      name,
      label,
      canDelete,
      savedMetrics,
      datasource,
    ],
  );

  const labelGhostButtonText = useMemo(
    () =>
      ghostButtonText ??
      tn(
        'Drop a column/metric here or click',
        'Drop columns/metrics here or click',
        multi ? 2 : 1,
      ),
    [ghostButtonText, multi],
  );

  const toggleColumnPopover = useCallback((visible: boolean) => {
    setNewColumnPopoverVisible(visible);
  }, []);

  const closeColumnPopover = useCallback(() => {
    toggleColumnPopover(false);
  }, [toggleColumnPopover]);

  const handleClickGhostButton = useCallback(() => {
    toggleColumnPopover(true);
  }, [toggleColumnPopover]);

  const addNewColumn = useCallback(
    (newItem: ColumnMeta | AdhocColumn | Metric | AdhocMetric) => {
      const newValues = [...coercedValue];
      if (isColumnMeta(newItem)) {
        newValues.push(newItem.column_name);
      } else if (isAdhocColumn(newItem)) {
        newValues.push(newItem);
      } else if ('metric_name' in newItem && newItem.metric_name) {
        newValues.push(newItem.metric_name);
      } else if (newItem instanceof AdhocMetric) {
        newValues.push(newItem);
      }
      onChange(multi ? newValues : newValues[0]);
    },
    [onChange, coercedValue, multi],
  );

  return (
    <div>
      <DndSelectLabel
        onDrop={onDrop}
        canDrop={canDrop}
        valuesRenderer={valuesRenderer}
        accept={DND_ACCEPTED_TYPES}
        displayGhostButton={multi || coercedValue.length === 0}
        ghostButtonText={labelGhostButtonText}
        onClickGhostButton={handleClickGhostButton}
        {...props}
      />
      <ColumnSelectPopoverTrigger
        columns={columns}
        onColumnEdit={addNewColumn}
        isControlledComponent
        visible={newColumnPopoverVisible}
        togglePopover={toggleColumnPopover}
        closePopover={closeColumnPopover}
        isTemporal={false}
        disabledTabs={disabledTabs}
        metrics={savedMetrics}
        selectedMetrics={selectedMetrics}
      >
        <div />
      </ColumnSelectPopoverTrigger>
    </div>
  );
}

export { DndColumnMetricSelect };
