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
  styled,
  SuperChart,
  t,
  getChartControlPanelRegistry,
  getChartMetadataRegistry,
  Behavior,
} from '@superset-ui/core';
import { FormInstance } from 'antd/lib/form';
import React, { useCallback } from 'react';
import {
  Button,
  Checkbox,
  Form,
  Input,
  Typography,
} from 'src/common/components';
import { Select } from 'src/components/Select/SupersetStyledSelect';
import SupersetResourceSelect from 'src/components/SupersetResourceSelect';
import { addDangerToast } from 'src/messageToasts/actions';
import { ClientErrorObject } from 'src/utils/getClientErrorObject';
import { CustomControlItem } from '@superset-ui/chart-controls';
import { ColumnSelect } from './ColumnSelect';
import { NativeFiltersForm } from './types';
import FilterScope from './FilterScope';
import { getControlItems, setFilterFieldValues, useForceUpdate } from './utils';
import { useBackendFormUpdate } from './state';
import { getFormData } from '../utils';
import { Filter } from '../types';

type DatasetSelectValue = {
  value: number;
  label: string;
};

const datasetToSelectOption = (item: any): DatasetSelectValue => ({
  value: item.id,
  label: item.table_name,
});

const RemovedContent = styled.div`
  display: flex;
  flex-direction: column;
  height: 400px; // arbitrary
  text-align: center;
  justify-content: center;
  align-items: center;
  color: ${({ theme }) => theme.colors.grayscale.base};
`;

const StyledContainer = styled.div`
  display: flex;
  flex-direction: row-reverse;
  justify-content: space-between;
`;

const StyledFormItem = styled(Form.Item)`
  width: 49%;
  margin-bottom: ${({ theme }) => theme.gridUnit * 4}px;
`;

const StyledCheckboxFormItem = styled(Form.Item)`
  margin-bottom: 0;
`;

const StyledLabel = styled.span`
  color: ${({ theme }) => theme.colors.grayscale.base};
  font-size: ${({ theme }) => theme.typography.sizes.s};
  text-transform: uppercase;
`;

const CleanFormItem = styled(Form.Item)`
  margin-bottom: 0;
`;

export interface FilterConfigFormProps {
  filterId: string;
  filterToEdit?: Filter;
  removed?: boolean;
  restore: (filterId: string) => void;
  form: FormInstance<NativeFiltersForm>;
  parentFilters: { id: string; title: string }[];
}

/**
 * The configuration form for a specific filter.
 * Assigns field values to `filters[filterId]` in the form.
 */
export const FilterConfigForm: React.FC<FilterConfigFormProps> = ({
  filterId,
  filterToEdit,
  removed,
  restore,
  form,
  parentFilters,
}) => {
  const controlPanelRegistry = getChartControlPanelRegistry();
  const forceUpdate = useForceUpdate();
  const formFilter = (form.getFieldValue('filters') || {})[filterId];
  const controlItems = getControlItems(
    controlPanelRegistry.get(formFilter?.filterType),
  );

  const nativeFilterItems = getChartMetadataRegistry().items;
  const nativeFilterVizTypes = Object.entries(nativeFilterItems)
    // @ts-ignore
    .filter(([, { value }]) =>
      value.behaviors?.includes(Behavior.NATIVE_FILTER),
    )
    .map(([key]) => key);

  // @ts-ignore
  const hasDatasource = !!nativeFilterItems[formFilter?.filterType]?.value
    ?.datasourceCount;

  const hasFilledDatasource =
    (formFilter?.dataset && formFilter?.column) || !hasDatasource;

  useBackendFormUpdate(form, filterId, filterToEdit, hasDatasource);

  const initDatasetId = filterToEdit?.targets[0]?.datasetId;
  const initColumn = filterToEdit?.targets[0]?.column?.name;
  const newFormData = getFormData({
    datasetId: formFilter?.dataset?.value,
    groupby: formFilter?.column,
    defaultValue: formFilter?.defaultValue,
    ...formFilter,
  });

  const onDatasetSelectError = useCallback(
    ({ error, message }: ClientErrorObject) => {
      let errorText = message || error || t('An error has occurred');
      if (message === 'Forbidden') {
        errorText = t('You do not have permission to edit this dashboard');
      }
      addDangerToast(errorText);
    },
    [],
  );

  if (removed) {
    return (
      <RemovedContent>
        <p>{t('You have removed this filter.')}</p>
        <div>
          <Button
            data-test="restore-filter-button"
            type="primary"
            onClick={() => restore(filterId)}
          >
            {t('Restore Filter')}
          </Button>
        </div>
      </RemovedContent>
    );
  }

  const parentFilterOptions = parentFilters.map(filter => ({
    value: filter.id,
    label: filter.title,
  }));

  return (
    <>
      <Typography.Title level={5}>{t('Settings')}</Typography.Title>
      <StyledContainer>
        <StyledFormItem
          name={['filters', filterId, 'name']}
          label={<StyledLabel>{t('Filter name')}</StyledLabel>}
          initialValue={filterToEdit?.name}
          rules={[{ required: !removed, message: t('Name is required') }]}
          data-test="name-input"
        >
          <Input />
        </StyledFormItem>
        <StyledFormItem
          name={['filters', filterId, 'filterType']}
          rules={[{ required: !removed, message: t('Name is required') }]}
          initialValue={filterToEdit?.filterType || 'filter_select'}
          label={<StyledLabel>{t('Filter Type')}</StyledLabel>}
        >
          <Select
            options={nativeFilterVizTypes.map(filterType => ({
              value: filterType,
              // @ts-ignore
              label: nativeFilterItems[filterType]?.value.name,
            }))}
            onChange={({ value }: { value: string }) => {
              setFilterFieldValues(form, filterId, {
                filterType: value,
                defaultValue: null,
              });
              forceUpdate();
            }}
          />
        </StyledFormItem>
      </StyledContainer>
      {hasDatasource && (
        <>
          <StyledFormItem
            name={['filters', filterId, 'dataset']}
            initialValue={{ value: initDatasetId }}
            label={<StyledLabel>{t('Datasource')}</StyledLabel>}
            rules={[
              { required: !removed, message: t('Datasource is required') },
            ]}
            data-test="datasource-input"
          >
            <SupersetResourceSelect
              initialId={initDatasetId}
              resource="dataset"
              searchColumn="table_name"
              transformItem={datasetToSelectOption}
              isMulti={false}
              onError={onDatasetSelectError}
              onChange={e => {
                // We need reset column when dataset changed
                const datasetId = formFilter?.dataset?.value;
                if (datasetId && e?.value !== datasetId) {
                  setFilterFieldValues(form, filterId, {
                    column: null,
                  });
                }
                forceUpdate();
              }}
            />
          </StyledFormItem>
          <StyledFormItem
            // don't show the column select unless we have a dataset
            // style={{ display: datasetId == null ? undefined : 'none' }}
            name={['filters', filterId, 'column']}
            initialValue={initColumn}
            label={<StyledLabel>{t('Field')}</StyledLabel>}
            rules={[{ required: !removed, message: t('Field is required') }]}
            data-test="field-input"
          >
            <ColumnSelect
              form={form}
              filterId={filterId}
              datasetId={formFilter?.dataset?.value}
              onChange={forceUpdate}
            />
          </StyledFormItem>
        </>
      )}
      {hasFilledDatasource && (
        <CleanFormItem
          name={['filters', filterId, 'defaultValueFormData']}
          hidden
          initialValue={newFormData}
        />
      )}
      <CleanFormItem
        name={['filters', filterId, 'defaultValueQueriesData']}
        hidden
        initialValue={null}
      />
      <StyledFormItem
        name={['filters', filterId, 'defaultValue']}
        initialValue={filterToEdit?.defaultValue}
        data-test="default-input"
        label={<StyledLabel>{t('Default Value')}</StyledLabel>}
      >
        {((hasFilledDatasource && formFilter?.defaultValueQueriesData) ||
          !hasDatasource) && (
          <SuperChart
            height={25}
            width={250}
            formData={newFormData}
            // For charts that don't have datasource we need workaround for empty placeholder
            queriesData={
              hasDatasource
                ? formFilter?.defaultValueQueriesData
                : [{ data: [null] }]
            }
            chartType={formFilter?.filterType}
            hooks={{
              setExtraFormData: ({ currentState }) => {
                setFilterFieldValues(form, filterId, {
                  defaultValue: currentState?.value,
                });
                forceUpdate();
              },
            }}
          />
        )}
      </StyledFormItem>
      <StyledFormItem
        name={['filters', filterId, 'parentFilter']}
        label={<StyledLabel>{t('Parent filter')}</StyledLabel>}
        initialValue={parentFilterOptions.find(
          ({ value }) => value === filterToEdit?.cascadeParentIds[0],
        )}
        data-test="parent-filter-input"
      >
        <Select
          placeholder={t('None')}
          options={parentFilterOptions}
          isClearable
        />
      </StyledFormItem>
      <StyledCheckboxFormItem
        name={['filters', filterId, 'isInstant']}
        initialValue={filterToEdit?.isInstant}
        valuePropName="checked"
        colon={false}
      >
        <Checkbox data-test="apply-changes-instantly-checkbox">
          {t('Apply changes instantly')}
        </Checkbox>
      </StyledCheckboxFormItem>
      {controlItems
        .filter(
          (controlItem: CustomControlItem) =>
            controlItem?.config?.renderTrigger,
        )
        .map(controlItem => (
          <StyledCheckboxFormItem
            name={['filters', filterId, 'controlValues', controlItem.name]}
            initialValue={filterToEdit?.controlValues?.[controlItem.name]}
            valuePropName="checked"
            colon={false}
          >
            <Checkbox
              onChange={() => {
                if (!controlItem.config.resetConfig) {
                  return;
                }
                setFilterFieldValues(form, filterId, {
                  defaultValue: null,
                });
                forceUpdate();
              }}
            >
              {controlItem.config.label}
            </Checkbox>
          </StyledCheckboxFormItem>
        ))}
      <FilterScope
        filterId={filterId}
        filterToEdit={filterToEdit}
        form={form}
      />
    </>
  );
};

export default FilterConfigForm;
