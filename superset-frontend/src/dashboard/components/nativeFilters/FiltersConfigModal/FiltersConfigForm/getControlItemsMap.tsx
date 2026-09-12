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
import {
  BaseControlConfig,
  CustomControlItem,
} from '@superset-ui/chart-controls';
import { ReactNode, useState, useEffect, useRef } from 'react';
import rison from 'rison';
import { cachedSupersetGet } from 'src/utils/cachedSupersetGet';
import {
  Checkbox,
  FormItem,
  InfoTooltip,
  Select,
  Tooltip,
  type FormInstance,
} from '@superset-ui/core/components';
import { t } from '@apache-superset/core/translation';
import {
  Filter,
  ChartCustomization,
  DatasourceType,
  getChartControlPanelRegistry,
} from '@superset-ui/core';
import { styled } from '@apache-superset/core/theme';
import {
  doesColumnMatchFilterType,
  getControlItems,
  setNativeFilterFieldValues,
} from './utils';
import { NativeFiltersForm, NativeFiltersFormItem } from '../types';
import {
  StyledFormItem,
  StyledLabel,
  StyledRowFormItem,
} from './FiltersConfigForm';
import { ColumnSelect } from './ColumnSelect';

export interface ControlItemsProps {
  expanded: boolean;
  datasetId: number;
  datasourceType?: DatasourceType;
  disabled: boolean;
  forceUpdate: Function;
  formChanged: Function;
  form: FormInstance<NativeFiltersForm>;
  filterId: string;
  filterType: string;
  filterToEdit?: Filter;
  customizationToEdit?: ChartCustomization;
  formFilter?: NativeFiltersFormItem;
  removed?: boolean;
}

const CleanFormItem = styled(FormItem)`
  margin-bottom: 0;
`;

/** Resolves the saved or default initial value for a control. */
function resolveInitialValue(
  controlItem: CustomControlItem,
  filterToEdit?: ControlItemsProps['filterToEdit'],
  customizationToEdit?: ControlItemsProps['customizationToEdit'],
) {
  return (
    filterToEdit?.controlValues?.[controlItem.name] ??
    customizationToEdit?.controlValues?.[controlItem.name] ??
    controlItem?.config?.default ??
    null
  );
}

/** Renders a StyledLabel with an optional description tooltip. */
function ControlLabel({
  label,
  description,
  fallbackLabel,
}: {
  label?: BaseControlConfig['label'];
  description?: BaseControlConfig['description'];
  fallbackLabel?: ReactNode;
}) {
  // Only zero-argument label/description functions are safe to invoke here:
  // (state, controlState, chartState) are supplied by the Explore control
  // panel renderer (ControlPanelsContainer), which this filter-config-modal
  // control list does not have access to.
  const resolvedLabel =
    (typeof label === 'function'
      ? label.length === 0
        ? (label as () => ReactNode)()
        : undefined
      : label) ?? fallbackLabel;
  const resolvedDescription =
    typeof description === 'function'
      ? description.length === 0
        ? (description as () => ReactNode)()
        : undefined
      : description;
  return (
    <StyledLabel>
      {resolvedLabel}
      {resolvedDescription != null && (
        <>
          &nbsp;
          <InfoTooltip placement="top" tooltip={resolvedDescription} />
        </>
      )}
    </StyledLabel>
  );
}

function DatasetColumnSelect({
  datasetId,
  value,
  onChange,
}: {
  datasetId?: number;
  value?: string | null;
  onChange?: (value: string | null) => void;
}) {
  const [{ loadedForId, fetchedColumns }, setFetchState] = useState<{
    loadedForId?: number;
    fetchedColumns: string[];
  }>({ fetchedColumns: [] });

  // Read via ref inside the async handlers below so a value change that
  // happens while the request is in flight is validated against the
  // current value, not the one captured when the effect started.
  const valueRef = useRef(value);
  valueRef.current = value;

  const loading = !!(datasetId && loadedForId !== datasetId);
  const options = loadedForId === datasetId ? fetchedColumns : [];

  useEffect(() => {
    if (!datasetId) {
      // dataset cleared — drop any stale selection immediately
      if (value) {
        onChange?.(null);
      }
      return undefined;
    }
    let cancelled = false;
    cachedSupersetGet({
      endpoint: `/api/v1/dataset/${datasetId}?q=${rison.encode({
        columns: ['columns.column_name'],
      })}`,
    })
      .then(({ json: { result } }) => {
        if (cancelled) return;
        const columnNames: string[] = result.columns
          .map((col: { column_name: string }) => col.column_name)
          .filter(Boolean);
        setFetchState({ loadedForId: datasetId, fetchedColumns: columnNames });
        if (valueRef.current && !columnNames.includes(valueRef.current)) {
          onChange?.(null);
        }
      })
      .catch(() => {
        if (cancelled) return;
        // A failed fetch tells us nothing about the value's validity —
        // only clear it when a successful response says so.
        setFetchState({
          loadedForId: datasetId,
          fetchedColumns: valueRef.current ? [valueRef.current] : [],
        });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datasetId]);

  return (
    <Select
      allowClear
      ariaLabel={t('Column')}
      loading={loading}
      value={value ?? undefined}
      onChange={val => onChange?.(typeof val === 'string' ? val : null)}
      options={options.map(col => ({ label: col, value: col }))}
      placeholder={t('None — show filter values as labels')}
      showSearch
    />
  );
}

export default function getControlItemsMap({
  expanded,
  datasetId,
  datasourceType,
  disabled,
  forceUpdate,
  formChanged,
  form,
  filterId,
  filterType,
  filterToEdit,
  customizationToEdit,
  formFilter,
  removed,
}: ControlItemsProps) {
  const controlPanelRegistry = getChartControlPanelRegistry();
  const controlItems =
    getControlItems(controlPanelRegistry.get(filterType)) ?? [];
  const notifyChange = () => {
    forceUpdate();
    formChanged();
  };
  const mapControlItems: Record<
    string,
    { element: ReactNode; checked: boolean }
  > = {};
  const mapMainControlItems: Record<
    string,
    { element: ReactNode; checked: boolean }
  > = {};

  controlItems
    .filter(
      (mainControlItem: CustomControlItem) =>
        mainControlItem?.name === 'groupby',
    )
    .forEach(mainControlItem => {
      const initialValue = resolveInitialValue(
        mainControlItem,
        filterToEdit,
        customizationToEdit,
      );
      const initColumn =
        customizationToEdit?.targets?.[0]?.column?.name ??
        filterToEdit?.targets?.[0]?.column?.name;

      const element = (
        <>
          <CleanFormItem
            name={['filters', filterId, 'requiredFirst', mainControlItem.name]}
            hidden
            initialValue={
              mainControlItem?.config?.requiredFirst &&
              filterToEdit?.requiredFirst
            }
          />
          <StyledFormItem
            expanded={expanded}
            // don't show the column select unless we have a dataset
            name={['filters', filterId, 'column']}
            initialValue={initColumn}
            label={
              <ControlLabel
                label={mainControlItem.config?.label}
                fallbackLabel={t('Column')}
              />
            }
            rules={[
              {
                required: mainControlItem.config?.required && !removed, // TODO: need to move ColumnSelect settings to controlPanel for all filters
                message: t('Column is required'),
              },
            ]}
            data-test="field-input"
          >
            <ColumnSelect
              mode={mainControlItem.config?.multiple && 'multiple'}
              form={form}
              filterId={filterId}
              datasetId={datasetId}
              datasourceType={datasourceType}
              filterValues={column =>
                doesColumnMatchFilterType(
                  formFilter?.filterType || '',
                  column,
                ) && !!column?.filterable
              }
              onChange={() => {
                // We need reset default value when column changed
                setNativeFilterFieldValues(form, filterId, {
                  defaultDataMask: null,
                });
                notifyChange();
              }}
            />
          </StyledFormItem>
        </>
      );
      mapMainControlItems[mainControlItem.name] = {
        element,
        checked: initialValue,
      };
    });
  controlItems
    .filter(
      (controlItem: CustomControlItem) =>
        controlItem?.config?.renderTrigger &&
        controlItem.name !== 'sortAscending' &&
        controlItem.name !== 'enableSingleValue' &&
        controlItem.name !== 'operatorType',
    )
    .forEach(controlItem => {
      const initialValue = resolveInitialValue(
        controlItem,
        filterToEdit,
        customizationToEdit,
      );
      const element = (
        <>
          <CleanFormItem
            name={['filters', filterId, 'requiredFirst', controlItem.name]}
            hidden
            initialValue={
              controlItem?.config?.requiredFirst && filterToEdit?.requiredFirst
            }
          />
          <Tooltip
            key={controlItem.name}
            placement="left"
            title={
              controlItem.config.affectsDataMask &&
              disabled &&
              t('Populate "Default value" to enable this control')
            }
          >
            {/* Wrap in span so antd Tooltip can attach a ref without
                relying on findDOMNode (deprecated in React 18+). */}
            <span>
              <StyledRowFormItem
                expanded={expanded}
                key={controlItem.name}
                name={['filters', filterId, 'controlValues', controlItem.name]}
                initialValue={initialValue}
                valuePropName="checked"
                colon={false}
              >
                <Checkbox
                  disabled={controlItem.config.affectsDataMask && disabled}
                  onChange={checked => {
                    if (controlItem.config.requiredFirst) {
                      setNativeFilterFieldValues(form, filterId, {
                        requiredFirst: {
                          ...formFilter?.requiredFirst,
                          [controlItem.name]: checked,
                        },
                      });
                    }
                    if (controlItem.config.resetConfig) {
                      setNativeFilterFieldValues(form, filterId, {
                        defaultDataMask: null,
                      });
                    }
                    notifyChange();
                  }}
                >
                  <ControlLabel
                    label={controlItem.config.label}
                    description={controlItem.config.description}
                    fallbackLabel={controlItem.name}
                  />
                </Checkbox>
              </StyledRowFormItem>
            </span>
          </Tooltip>
        </>
      );
      mapControlItems[controlItem.name] = { element, checked: initialValue };
    });

  // Render plugin-declared column-picker controls using config hooks
  controlItems
    .filter((item: CustomControlItem) => item?.config?.isColumnSelect === true)
    .forEach(controlItem => {
      const initialValue = resolveInitialValue(
        controlItem,
        filterToEdit,
        customizationToEdit,
      );
      const element = (
        <StyledFormItem
          expanded={expanded}
          name={['filters', filterId, 'controlValues', controlItem.name]}
          initialValue={initialValue}
          label={
            <ControlLabel
              label={controlItem.config?.label}
              description={controlItem.config?.description}
              fallbackLabel={controlItem.name}
            />
          }
          rules={[
            {
              required: controlItem.config?.required && !removed,
              message: t('This field is required'),
            },
          ]}
        >
          <DatasetColumnSelect
            datasetId={datasetId}
            onChange={() => {
              // We need reset default value when column changed
              setNativeFilterFieldValues(form, filterId, {
                defaultDataMask: null,
              });
              notifyChange();
            }}
          />
        </StyledFormItem>
      );
      mapMainControlItems[controlItem.name] = {
        element,
        checked: initialValue,
      };
    });
  return {
    controlItems: mapControlItems,
    mainControlItems: mapMainControlItems,
  };
}
