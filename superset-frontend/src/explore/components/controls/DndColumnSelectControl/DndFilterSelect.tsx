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
  FeatureFlag,
  isFeatureEnabled,
  logging,
  Metric,
  QueryFormData,
  QueryFormMetric,
  SupersetClient,
  t,
} from '@superset-ui/core';
import { ColumnMeta } from '@superset-ui/chart-controls';
import {
  OPERATOR_ENUM_TO_OPERATOR_TYPE,
  Operators,
} from 'src/explore/constants';
import { Datasource, OptionSortType } from 'src/explore/types';
import { OptionValueType } from 'src/explore/components/controls/DndColumnSelectControl/types';
import AdhocFilterPopoverTrigger from 'src/explore/components/controls/FilterControl/AdhocFilterPopoverTrigger';
import OptionWrapper from 'src/explore/components/controls/DndColumnSelectControl/OptionWrapper';
import DndSelectLabel from 'src/explore/components/controls/DndColumnSelectControl/DndSelectLabel';
import AdhocFilter, {
  CLAUSES,
  EXPRESSION_TYPES,
} from 'src/explore/components/controls/FilterControl/AdhocFilter';
import AdhocMetric from 'src/explore/components/controls/MetricControl/AdhocMetric';
import {
  DatasourcePanelDndItem,
  DndItemValue,
  isSavedMetric,
} from 'src/explore/components/DatasourcePanel/types';
import { DndItemType } from 'src/explore/components/DndItemType';
import { ControlComponentProps } from 'src/explore/components/Control';

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
}

export const DndFilterSelect = (props: DndFilterSelectProps) => {
  const { datasource, onChange = () => {}, name: controlName } = props;

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

  useEffect(() => {
    if (datasource && datasource.type === 'table') {
      const dbId = datasource.database?.id;
      const {
        datasource_name: name,
        schema,
        is_sqllab_view: isSqllabView,
      } = datasource;

      if (!isSqllabView && dbId && name && schema) {
        SupersetClient.get({
          endpoint: `/superset/extra_table_metadata/${dbId}/${name}/${schema}/`,
        })
          .then(({ json }: { json: Record<string, any> }) => {
            if (json && json.partitions) {
              const { partitions } = json;
              // for now only show latest_partition option
              // when table datasource has only 1 partition key.
              if (
                partitions &&
                partitions.cols &&
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

  const onClickClose = useCallback(
    (index: number) => {
      const valuesCopy = [...values];
      valuesCopy.splice(index, 1);
      setValues(valuesCopy);
      onChange(valuesCopy);
    },
    [onChange, values],
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
          expressionType:
            datasource.type === 'druid'
              ? EXPRESSION_TYPES.SIMPLE
              : EXPRESSION_TYPES.SQL,
          subject:
            datasource.type === 'druid'
              ? filterOptions.saved_metric_name
              : getMetricExpression(filterOptions.saved_metric_name),
          operator:
            OPERATOR_ENUM_TO_OPERATOR_TYPE[Operators.GREATER_THAN].operation,
          operatorId: Operators.GREATER_THAN,
          comparator: 0,
          clause: CLAUSES.HAVING,
        });
      }
      // has a custom label, meaning it's custom column
      if (filterOptions.label) {
        return new AdhocFilter({
          expressionType:
            datasource.type === 'druid'
              ? EXPRESSION_TYPES.SIMPLE
              : EXPRESSION_TYPES.SQL,
          subject:
            datasource.type === 'druid'
              ? filterOptions.label
              : new AdhocMetric(option).translateToSql(),
          operator:
            OPERATOR_ENUM_TO_OPERATOR_TYPE[Operators.GREATER_THAN].operation,
          operatorId: Operators.GREATER_THAN,
          comparator: 0,
          clause: CLAUSES.HAVING,
        });
      }
      // add a new filter item
      if (filterOptions.column_name) {
        return new AdhocFilter({
          expressionType: EXPRESSION_TYPES.SIMPLE,
          subject: filterOptions.column_name,
          operator: OPERATOR_ENUM_TO_OPERATOR_TYPE[Operators.EQUALS].operation,
          operatorId: Operators.EQUALS,
          comparator: '',
          clause: CLAUSES.WHERE,
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
      values.map((adhocFilter: AdhocFilter, index: number) => {
        const label = adhocFilter.getDefaultLabel();
        const tooltipTitle = adhocFilter.getTooltipTitle();
        return (
          <AdhocFilterPopoverTrigger
            key={index}
            adhocFilter={adhocFilter}
            options={options}
            datasource={datasource}
            onFilterEdit={onFilterEdit}
            partitionColumn={partitionColumn}
          >
            <OptionWrapper
              key={index}
              index={index}
              label={label}
              tooltipTitle={tooltipTitle}
              clickClose={onClickClose}
              onShiftOptions={onShiftOptions}
              type={DndItemType.FilterOption}
              withCaret
              isExtra={adhocFilter.isExtra}
            />
          </AdhocFilterPopoverTrigger>
        );
      }),
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

  const adhocFilter = useMemo(() => {
    if (isSavedMetric(droppedItem)) {
      return new AdhocFilter({
        expressionType: EXPRESSION_TYPES.SQL,
        clause: CLAUSES.HAVING,
        sqlExpression: droppedItem?.expression,
      });
    }
    if (droppedItem instanceof AdhocMetric) {
      return new AdhocFilter({
        expressionType: EXPRESSION_TYPES.SQL,
        clause: CLAUSES.HAVING,
        sqlExpression: (droppedItem as AdhocMetric)?.translateToSql(),
      });
    }
    const config: Partial<AdhocFilter> = {
      subject: (droppedItem as ColumnMeta)?.column_name,
    };
    if (config.subject && isFeatureEnabled(FeatureFlag.UX_BETA)) {
      config.operator = OPERATOR_ENUM_TO_OPERATOR_TYPE[Operators.IN].operation;
      config.operatorId = Operators.IN;
    }
    return new AdhocFilter(config);
  }, [droppedItem]);

  const canDrop = useCallback(() => true, []);
  const handleDrop = useCallback(
    (item: DatasourcePanelDndItem) => {
      setDroppedItem(item.value);
      togglePopover(true);
    },
    [controlName, togglePopover],
  );

  const ghostButtonText = isFeatureEnabled(FeatureFlag.ENABLE_DND_WITH_CLICK_UX)
    ? t('Drop columns/metrics here or click')
    : t('Drop columns or metrics here');

  return (
    <>
      <DndSelectLabel
        onDrop={handleDrop}
        canDrop={canDrop}
        valuesRenderer={valuesRenderer}
        accept={DND_ACCEPTED_TYPES}
        ghostButtonText={ghostButtonText}
        onClickGhostButton={
          isFeatureEnabled(FeatureFlag.ENABLE_DND_WITH_CLICK_UX)
            ? handleClickGhostButton
            : undefined
        }
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
      >
        <div />
      </AdhocFilterPopoverTrigger>
    </>
  );
};
