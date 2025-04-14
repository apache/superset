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
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  logging,
  Metric,
  QueryFormData,
  QueryFormMetric,
  SupersetClient,
  t,
} from '@superset-ui/core';
import {
  ColumnMeta,
  isColumnMeta,
  isTemporalColumn,
} from '@superset-ui/chart-controls';
import Modal from 'src/components/Modal';
import {
  OPERATOR_ENUM_TO_OPERATOR_TYPE,
  Operators,
} from 'src/explore/constants';
import { Datasource, OptionSortType } from 'src/explore/types';
import { OptionValueType } from 'src/explore/components/controls/DndColumnSelectControl/types';
import AdhocFilterPopoverTrigger from 'src/explore/components/controls/FilterControl/AdhocFilterPopoverTrigger';
import DndSelectLabel from 'src/explore/components/controls/DndColumnSelectControl/DndSelectLabel';
import AdhocFilter from 'src/explore/components/controls/FilterControl/AdhocFilter';
import AdhocMetric from 'src/explore/components/controls/MetricControl/AdhocMetric';
import {
  DatasourcePanelDndItem,
  DndItemValue,
  isSavedMetric,
} from 'src/explore/components/DatasourcePanel/types';
import { DndItemType } from 'src/explore/components/DndItemType';
import { ControlComponentProps } from 'src/explore/components/Control';
import { toQueryString } from 'src/utils/urlUtils';
import DndAdhocFilterOption from './DndAdhocFilterOption';
import { useDefaultTimeFilter } from '../DateFilterControl/utils';
import { Clauses, ExpressionTypes } from '../FilterControl/types';

const { warning } = Modal;

const EMPTY_OBJECT = {};
const DND_ACCEPTED_TYPES = [
  DndItemType.Column,
  DndItemType.Metric,
  DndItemType.MetricOption,
  DndItemType.AdhocMetricOption,
];

const isDictionaryForAdhocFilter = (value: OptionValueType) =>
  !(value instanceof AdhocFilter) && value?.expressionType;

export interface DndFilterSelectProps
  extends ControlComponentProps<OptionValueType[]> {
  columns: ColumnMeta[];
  savedMetrics: Metric[];
  selectedMetrics: QueryFormMetric[];
  datasource: Datasource;
  canDelete?: (
    valueToBeDeleted: OptionValueType,
    values: OptionValueType[],
  ) => true | string;
}

const DndFilterSelect = (props: DndFilterSelectProps) => {
  const {
    datasource,
    onChange = () => {},
    name: controlName,
    canDelete,
  } = props;

  const extra = useMemo<{ disallow_adhoc_metrics?: boolean }>(() => {
    let extra = {};
    if (datasource?.extra) {
      try {
        extra = JSON.parse(datasource.extra);
      } catch {} // eslint-disable-line no-empty
    }
    return extra;
  }, [datasource?.extra]);

  const propsValues = Array.from(props.value ?? []);
  const [values, setValues] = useState(
    propsValues.map((filter: OptionValueType) =>
      isDictionaryForAdhocFilter(filter) ? new AdhocFilter(filter) : filter,
    ),
  );
  const [partitionColumn, setPartitionColumn] = useState(undefined);
  const [newFilterPopoverVisible, setNewFilterPopoverVisible] = useState(false);
  const [droppedItem, setDroppedItem] = useState<
    DndItemValue | typeof EMPTY_OBJECT
  >({});

  const optionsForSelect = (
    columns: ColumnMeta[],
    formData: QueryFormData | null | undefined,
  ) => {
    const options: OptionSortType[] = [
      ...columns,
      ...[...(formData?.metrics || []), formData?.metric].map(
        metric =>
          metric &&
          (typeof metric === 'string'
            ? { saved_metric_name: metric }
            : new AdhocMetric(metric)),
      ),
    ].filter(option => option);

    return options
      .reduce(
        (
          results: (OptionSortType & { filterOptionName: string })[],
          option,
        ) => {
          if ('saved_metric_name' in option && option.saved_metric_name) {
            results.push({
              ...option,
              filterOptionName: option.saved_metric_name,
            });
          } else if ('column_name' in option && option.column_name) {
            results.push({
              ...option,
              filterOptionName: `_col_${option.column_name}`,
            });
          } else if (option instanceof AdhocMetric) {
            results.push({
              ...option,
              filterOptionName: `_adhocmetric_${option.label}`,
            });
          }
          return results;
        },
        [],
      )
      .sort(
        (a: OptionSortType, b: OptionSortType) =>
          (a.saved_metric_name || a.column_name || a.label)?.localeCompare(
            b.saved_metric_name || b.column_name || b.label || '',
          ) ?? 0,
      );
  };
  const [options, setOptions] = useState(
    optionsForSelect(props.columns, props.formData),
  );

  const availableColumnSet = useMemo(
    () =>
      new Set(
        options.map(
          ({ column_name, filterOptionName }) =>
            column_name ?? filterOptionName,
        ),
      ),
    [options],
  );

  useEffect(() => {
    if (datasource && datasource.type === 'table') {
      const dbId = datasource.database?.id;
      const {
        datasource_name: name,
        catalog,
        schema,
        is_sqllab_view: isSqllabView,
      } = datasource;

      if (!isSqllabView && dbId && name && schema) {
        SupersetClient.get({
          endpoint: `/api/v1/database/${dbId}/table_metadata/extra/${toQueryString(
            {
              name,
              catalog,
              schema,
            },
          )}`,
        })
          .then(({ json }: { json: Record<string, any> }) => {
            if (json?.partitions) {
              const { partitions } = json;
              // for now only show latest_partition option
              // when table datasource has only 1 partition key.
              if (
                partitions?.cols &&
                Object.keys(partitions.cols).length === 1
              ) {
                setPartitionColumn(partitions.cols[0]);
              }
            }
          })
          .catch((error: Record<string, any>) => {
            logging.error('fetch extra_table_metadata:', error.statusText);
          });
      }
    }
  }, [datasource]);

  useEffect(() => {
    setOptions(optionsForSelect(props.columns, props.formData));
  }, [props.columns, props.formData]);

  useEffect(() => {
    setValues(
      (props.value || []).map((filter: OptionValueType) =>
        isDictionaryForAdhocFilter(filter) ? new AdhocFilter(filter) : filter,
      ),
    );
  }, [props.value]);

  const removeValue = useCallback(
    (index: number) => {
      const valuesCopy = [...values];
      valuesCopy.splice(index, 1);
      setValues(valuesCopy);
      onChange(valuesCopy);
    },
    [onChange, values],
  );

  const onClickClose = useCallback(
    (index: number) => {
      const result = canDelete?.(values[index], values);
      if (typeof result === 'string') {
        warning({ title: t('Warning'), content: result });
        return;
      }
      if (result === true) {
        removeValue(index);
      }
    },
    [canDelete, removeValue, values],
  );

  const onShiftOptions = useCallback(
    (dragIndex: number, hoverIndex: number) => {
      const newValues = [...values];
      [newValues[hoverIndex], newValues[dragIndex]] = [
        newValues[dragIndex],
        newValues[hoverIndex],
      ];
      setValues(newValues);
    },
    [values],
  );

  const getMetricExpression = useCallback(
    (savedMetricName: string) =>
      props.savedMetrics.find(
        (savedMetric: Metric) => savedMetric.metric_name === savedMetricName,
      )?.expression,
    [props.savedMetrics],
  );

  const mapOption = useCallback(
    (option: OptionValueType) => {
      // already a AdhocFilter, skip
      if (option instanceof AdhocFilter) {
        return option;
      }
      const filterOptions = option as Record<string, any>;
      // via datasource saved metric
      if (filterOptions.saved_metric_name) {
        return new AdhocFilter({
          expressionType: ExpressionTypes.Sql,
          subject: getMetricExpression(filterOptions.saved_metric_name),
          operator:
            OPERATOR_ENUM_TO_OPERATOR_TYPE[Operators.GreaterThan].operation,
          operatorId: Operators.GreaterThan,
          comparator: 0,
          clause: Clauses.Having,
        });
      }
      // has a custom label, meaning it's custom column
      if (filterOptions.label) {
        return new AdhocFilter({
          expressionType: ExpressionTypes.Sql,
          subject: new AdhocMetric(option).translateToSql(),
          operator:
            OPERATOR_ENUM_TO_OPERATOR_TYPE[Operators.GreaterThan].operation,
          operatorId: Operators.GreaterThan,
          comparator: 0,
          clause: Clauses.Having,
        });
      }
      // add a new filter item
      if (filterOptions.column_name) {
        return new AdhocFilter({
          expressionType: ExpressionTypes.Simple,
          subject: filterOptions.column_name,
          operator: OPERATOR_ENUM_TO_OPERATOR_TYPE[Operators.Equals].operation,
          operatorId: Operators.Equals,
          comparator: '',
          clause: Clauses.Where,
          isNew: true,
        });
      }
      return null;
    },
    [datasource.type, getMetricExpression],
  );

  const onFilterEdit = useCallback(
    (changedFilter: AdhocFilter) => {
      onChange(
        values.map((value: AdhocFilter) => {
          if (value.filterOptionName === changedFilter.filterOptionName) {
            return changedFilter;
          }
          return value;
        }),
      );
    },
    [onChange, values],
  );

  const onNewFilter = useCallback(
    (newFilter: AdhocFilter) => {
      const mappedOption = mapOption(newFilter);
      if (mappedOption) {
        const newValues = [...values, mappedOption];
        setValues(newValues);
        onChange(newValues);
      }
    },
    [mapOption, onChange, values],
  );

  const togglePopover = useCallback((visible: boolean) => {
    setNewFilterPopoverVisible(visible);
  }, []);

  const closePopover = useCallback(() => {
    togglePopover(false);
  }, [togglePopover]);

  const valuesRenderer = useCallback(
    () =>
      values.map((adhocFilter: AdhocFilter, index: number) => (
        <DndAdhocFilterOption
          index={index}
          adhocFilter={adhocFilter}
          options={options}
          datasource={datasource}
          onFilterEdit={onFilterEdit}
          partitionColumn={partitionColumn}
          onClickClose={onClickClose}
          onShiftOptions={onShiftOptions}
        />
      )),
    [
      onClickClose,
      onFilterEdit,
      onShiftOptions,
      options,
      partitionColumn,
      datasource,
      values,
    ],
  );

  const handleClickGhostButton = useCallback(() => {
    setDroppedItem({});
    togglePopover(true);
  }, [togglePopover]);

  const defaultTimeFilter = useDefaultTimeFilter();
  const adhocFilter = useMemo(() => {
    if (isSavedMetric(droppedItem)) {
      return new AdhocFilter({
        expressionType: ExpressionTypes.Sql,
        clause: Clauses.Having,
        sqlExpression: droppedItem?.expression,
      });
    }
    if (droppedItem instanceof AdhocMetric) {
      return new AdhocFilter({
        expressionType: ExpressionTypes.Sql,
        clause: Clauses.Having,
        sqlExpression: (droppedItem as AdhocMetric)?.translateToSql(),
      });
    }
    const config: Partial<AdhocFilter> = {
      subject: (droppedItem as ColumnMeta)?.column_name,
    };
    if (config.subject) {
      config.operator = OPERATOR_ENUM_TO_OPERATOR_TYPE[Operators.In].operation;
      config.operatorId = Operators.In;
    }
    if (
      isColumnMeta(droppedItem) &&
      isTemporalColumn(droppedItem?.column_name, props.datasource)
    ) {
      config.operator = Operators.TemporalRange;
      config.operatorId = Operators.TemporalRange;
      config.comparator = defaultTimeFilter;
    }
    return new AdhocFilter(config);
  }, [droppedItem]);

  const canDrop = useCallback(
    (item: DatasourcePanelDndItem) => {
      if (
        extra.disallow_adhoc_metrics &&
        (item.type !== DndItemType.Column ||
          !availableColumnSet.has((item.value as ColumnMeta).column_name))
      ) {
        return false;
      }

      if (item.type === DndItemType.Column) {
        const columnName = (item.value as ColumnMeta).column_name;
        return availableColumnSet.has(columnName);
      }
      return true;
    },
    [availableColumnSet, extra],
  );

  const handleDrop = useCallback(
    (item: DatasourcePanelDndItem) => {
      setDroppedItem(item.value);
      togglePopover(true);
    },
    [controlName, togglePopover],
  );

  return (
    <>
      <DndSelectLabel
        onDrop={handleDrop}
        canDrop={canDrop}
        valuesRenderer={valuesRenderer}
        accept={DND_ACCEPTED_TYPES}
        ghostButtonText={t('Drop columns/metrics here or click')}
        onClickGhostButton={handleClickGhostButton}
        {...props}
      />
      <AdhocFilterPopoverTrigger
        adhocFilter={adhocFilter}
        options={options}
        datasource={datasource}
        onFilterEdit={onNewFilter}
        partitionColumn={partitionColumn}
        isControlledComponent
        visible={newFilterPopoverVisible}
        togglePopover={togglePopover}
        closePopover={closePopover}
        requireSave={!!droppedItem}
      />
    </>
  );
};

export { DndFilterSelect };
