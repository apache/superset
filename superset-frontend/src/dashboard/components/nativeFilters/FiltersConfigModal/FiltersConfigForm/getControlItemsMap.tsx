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
import { CustomControlItem } from '@superset-ui/chart-controls';
import { ReactNode } from 'react';
import {
  Checkbox,
  FormItem,
  InfoTooltip,
  Tooltip,
  Select,
  Input,
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
      const initialValue =
        filterToEdit?.controlValues?.[mainControlItem.name] ??
        customizationToEdit?.controlValues?.[mainControlItem.name] ??
        mainControlItem?.config?.default;
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
              <StyledLabel>
                {typeof mainControlItem.config?.label === 'function'
                  ? (mainControlItem.config.label as Function)()
                  : mainControlItem.config?.label || t('Column')}
              </StyledLabel>
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
                forceUpdate();
                formChanged();
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
      const currentControlValues = {
        ...filterToEdit?.controlValues,
        ...customizationToEdit?.controlValues,
        ...formFilter?.controlValues,
        ...form.getFieldValue(['filters', filterId, 'controlValues']),
      };

      if (typeof controlItem.config?.visibility === 'function') {
        const isVisible = controlItem.config.visibility(
          {
            controls: Object.fromEntries(
              Object.entries(currentControlValues).map(([k, v]) => [
                k,
                { value: v },
              ]),
            ),
            form_data: currentControlValues,
          } as any,
          controlItem as any,
        );
        if (!isVisible) {
          return;
        }
      }

      const initialValue =
        filterToEdit?.controlValues?.[controlItem.name] ??
        customizationToEdit?.controlValues?.[controlItem.name] ??
        controlItem?.config?.default;

      const isSelect =
        controlItem?.config?.type === 'SelectControl' ||
        Boolean(controlItem?.config?.choices);
      const isText = controlItem?.config?.type === 'TextControl';

      const updateValue = (val: unknown) => {
        setNativeFilterFieldValues(form, filterId, {
          controlValues: {
            ...formFilter?.controlValues,
            [controlItem.name]: val,
          },
        });
        if (controlItem.config?.resetConfig) {
          setNativeFilterFieldValues(form, filterId, {
            defaultDataMask: null,
          });
        }
        formChanged();
        forceUpdate();
      };

      const labelContent =
        typeof controlItem.config?.label === 'function'
          ? (controlItem.config.label as () => ReactNode)()
          : controlItem.config?.label;
      const descriptionContent =
        typeof controlItem.config?.description === 'function'
          ? (controlItem.config.description as () => ReactNode)()
          : controlItem.config?.description;

      const label = (
        <StyledLabel>
          {labelContent}&nbsp;
          {descriptionContent && (
            <InfoTooltip placement="top" tooltip={descriptionContent} />
          )}
        </StyledLabel>
      );

      let controlNode: ReactNode;

      if (isSelect) {
        const rawChoices =
          (controlItem.config.choices as (string | [string, string])[]) || [];
        const options = rawChoices.map(choice =>
          Array.isArray(choice)
            ? { value: choice[0], label: choice[1] }
            : { value: choice, label: choice },
        );

        controlNode = (
          <StyledFormItem
            expanded={expanded}
            key={controlItem.name}
            name={['filters', filterId, 'controlValues', controlItem.name]}
            initialValue={initialValue}
            label={label}
          >
            <Select
              options={options}
              value={
                form.getFieldValue([
                  'filters',
                  filterId,
                  'controlValues',
                  controlItem.name,
                ]) ?? initialValue
              }
              onChange={updateValue}
              placeholder={t('Select...')}
            />
          </StyledFormItem>
        );
      } else if (isText) {
        controlNode = (
          <StyledFormItem
            expanded={expanded}
            key={controlItem.name}
            name={['filters', filterId, 'controlValues', controlItem.name]}
            initialValue={initialValue}
            label={label}
          >
            <Input
              value={
                form.getFieldValue([
                  'filters',
                  filterId,
                  'controlValues',
                  controlItem.name,
                ]) ?? initialValue
              }
              onChange={e => updateValue(e.target.value)}
            />
          </StyledFormItem>
        );
      } else {
        controlNode = (
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
                    formChanged();
                    forceUpdate();
                  }}
                >
                  {label}
                </Checkbox>
              </StyledRowFormItem>
            </span>
          </Tooltip>
        );
      }

      const element = (
        <>
          <CleanFormItem
            name={['filters', filterId, 'requiredFirst', controlItem.name]}
            hidden
            initialValue={
              controlItem?.config?.requiredFirst && filterToEdit?.requiredFirst
            }
          />
          {controlNode}
        </>
      );

      mapControlItems[controlItem.name] = { element, checked: initialValue };
    });
  return {
    controlItems: mapControlItems,
    mainControlItems: mapMainControlItems,
  };
}
