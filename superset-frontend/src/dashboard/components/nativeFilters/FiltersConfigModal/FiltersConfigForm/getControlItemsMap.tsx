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
  CustomControlItem,
  InfoTooltipWithTrigger,
} from '@superset-ui/chart-controls';
import React from 'react';
import { Checkbox } from 'src/common/components';
import { FormInstance } from 'antd/lib/form';
import { getChartControlPanelRegistry, t } from '@superset-ui/core';
import { Tooltip } from 'src/components/Tooltip';
import { getControlItems, setNativeFilterFieldValues } from './utils';
import { NativeFiltersForm } from '../types';
import { StyledRowFormItem } from './FiltersConfigForm';
import { Filter } from '../../types';

export interface ControlItemsProps {
  disabled: boolean;
  forceUpdate: Function;
  form: FormInstance<NativeFiltersForm>;
  filterId: string;
  filterType: string;
  filterToEdit?: Filter;
}

export default function getControlItemsMap({
  disabled,
  forceUpdate,
  form,
  filterId,
  filterType,
  filterToEdit,
}: ControlItemsProps) {
  const controlPanelRegistry = getChartControlPanelRegistry();
  const controlItems =
    getControlItems(controlPanelRegistry.get(filterType)) ?? [];
  const map = {};

  controlItems
    .filter(
      (controlItem: CustomControlItem) =>
        controlItem?.config?.renderTrigger &&
        controlItem.name !== 'sortAscending',
    )
    .forEach(controlItem => {
      const element = (
        <Tooltip
          key={controlItem.name}
          placement="left"
          title={
            controlItem.config.affectsDataMask &&
            disabled &&
            t('Populate "Default value" to enable this control')
          }
        >
          <StyledRowFormItem
            key={controlItem.name}
            name={['filters', filterId, 'controlValues', controlItem.name]}
            initialValue={
              filterToEdit?.controlValues?.[controlItem.name] ??
              controlItem?.config?.default
            }
            valuePropName="checked"
            colon={false}
          >
            <Checkbox
              disabled={controlItem.config.affectsDataMask && disabled}
              onChange={() => {
                if (!controlItem.config.resetConfig) {
                  forceUpdate();
                  return;
                }
                setNativeFilterFieldValues(form, filterId, {
                  defaultDataMask: null,
                });
                forceUpdate();
              }}
            >
              {controlItem.config.label}{' '}
              {controlItem.config.description && (
                <InfoTooltipWithTrigger
                  placement="top"
                  label={controlItem.config.name}
                  tooltip={controlItem.config.description}
                />
              )}
            </Checkbox>
          </StyledRowFormItem>
        </Tooltip>
      );
      map[controlItem.name] = element;
    });
  return map;
}
