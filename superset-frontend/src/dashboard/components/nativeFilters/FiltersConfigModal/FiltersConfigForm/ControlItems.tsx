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
import React, { FC } from 'react';
import { Checkbox } from 'src/common/components';
import { FormInstance } from 'antd/lib/form';
import { getChartControlPanelRegistry } from '@superset-ui/core';
import { getControlItems, setNativeFilterFieldValues } from './utils';
import { NativeFiltersForm, NativeFiltersFormItem } from '../types';
import { StyledCheckboxFormItem } from './FiltersConfigForm';
import { Filter } from '../../types';

type ControlItemsProps = {
  filterId: string;
  forceUpdate: Function;
  filterToEdit?: Filter;
  form: FormInstance<NativeFiltersForm>;
  formFilter?: NativeFiltersFormItem;
};

const ControlItems: FC<ControlItemsProps> = ({
  forceUpdate,
  form,
  filterId,
  filterToEdit,
  formFilter,
}) => {
  const filterType = formFilter?.filterType;

  if (!filterType) return null;

  const controlPanelRegistry = getChartControlPanelRegistry();
  const controlItems =
    getControlItems(controlPanelRegistry.get(filterType)) ?? [];
  return (
    <>
      {controlItems
        .filter(
          (controlItem: CustomControlItem) =>
            controlItem?.config?.renderTrigger,
        )
        .map(controlItem => (
          <StyledCheckboxFormItem
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
              onChange={() => {
                if (!controlItem.config.resetConfig) {
                  return;
                }
                setNativeFilterFieldValues(form, filterId, {
                  defaultValue: null,
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
          </StyledCheckboxFormItem>
        ))}
    </>
  );
};
export default ControlItems;
