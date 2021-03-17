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
  t,
  getChartMetadataRegistry,
  Behavior,
} from '@superset-ui/core';
import { FormInstance } from 'antd/lib/form';
import React, { useCallback } from 'react';
import { Checkbox, Form, Input, Typography } from 'src/common/components';
import { Select } from 'src/components/Select';
import SupersetResourceSelect from 'src/components/SupersetResourceSelect';
import { addDangerToast } from 'src/messageToasts/actions';
import { ClientErrorObject } from 'src/utils/getClientErrorObject';
import { ColumnSelect } from './ColumnSelect';
import { NativeFiltersForm } from '../types';
import {
  datasetToSelectOption,
  setNativeFilterFieldValues,
  useForceUpdate,
} from './utils';
import { useBackendFormUpdate } from './state';
import { getFormData } from '../../utils';
import { Filter } from '../../types';
import ControlItems from './ControlItems';
import FilterScope from './FilterScope/FilterScope';
import RemovedFilter from './RemovedFilter';
import DefaultValue from './DefaultValue';

const StyledContainer = styled.div`
  display: flex;
  flex-direction: row-reverse;
  justify-content: space-between;
`;

export const StyledFormItem = styled(Form.Item)`
  width: 49%;
  margin-bottom: ${({ theme }) => theme.gridUnit * 4}px;
`;

export const StyledCheckboxFormItem = styled(Form.Item)`
  margin-bottom: 0;
`;

export const StyledLabel = styled.span`
  color: ${({ theme }) => theme.colors.grayscale.base};
  font-size: ${({ theme }) => theme.typography.sizes.s};
  text-transform: uppercase;
`;

const CleanFormItem = styled(Form.Item)`
  margin-bottom: 0;
`;

export interface FiltersConfigFormProps {
  filterId: string;
  filterToEdit?: Filter;
  removed?: boolean;
  restoreFilter: (filterId: string) => void;
  form: FormInstance<NativeFiltersForm>;
  parentFilters: { id: string; title: string }[];
}

const FILTERS_WITH_ONLY_DATASOURCE = ['filter_timegrain', 'filter_timecolumn'];

/**
 * The configuration form for a specific filter.
 * Assigns field values to `filters[filterId]` in the form.
 */
export const FiltersConfigForm: React.FC<FiltersConfigFormProps> = ({
  filterId,
  filterToEdit,
  removed,
  restoreFilter,
  form,
  parentFilters,
}) => {
  const forceUpdate = useForceUpdate();
  const formFilter = (form.getFieldValue('filters') || {})[filterId];

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
  const hasColumn =
    hasDatasource &&
    !FILTERS_WITH_ONLY_DATASOURCE.includes(formFilter?.filterType);

  const hasFilledDatasource =
    !hasDatasource ||
    (formFilter?.dataset?.value && (formFilter?.column || !hasColumn));

  useBackendFormUpdate(form, filterId, filterToEdit, hasDatasource, hasColumn);

  const initDatasetId = filterToEdit?.targets[0]?.datasetId;
  const initColumn = filterToEdit?.targets[0]?.column?.name;
  const newFormData = getFormData({
    datasetId: formFilter?.dataset?.value,
    groupby: hasColumn ? formFilter?.column : undefined,
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
    return <RemovedFilter onClick={() => restoreFilter(filterId)} />;
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
              setNativeFilterFieldValues(form, filterId, {
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
                  setNativeFilterFieldValues(form, filterId, {
                    column: null,
                  });
                }
                forceUpdate();
              }}
            />
          </StyledFormItem>
          {hasColumn && (
            <StyledFormItem
              // don't show the column select unless we have a dataset
              // style={{ display: datasetId == null ? undefined : 'none' }}
              name={['filters', filterId, 'column']}
              initialValue={initColumn}
              label={<StyledLabel>{t('Column')}</StyledLabel>}
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
          )}
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
      <DefaultValue
        forceUpdate={forceUpdate}
        filterId={filterId}
        hasFilledDatasource={hasFilledDatasource}
        hasDatasource={hasDatasource}
        filterToEdit={filterToEdit}
        form={form}
        formData={newFormData}
      />
      <StyledCheckboxFormItem
        name={['filters', filterId, 'isInstant']}
        initialValue={filterToEdit?.isInstant || false}
        valuePropName="checked"
        colon={false}
      >
        <Checkbox data-test="apply-changes-instantly-checkbox">
          {t('Apply changes instantly')}
        </Checkbox>
      </StyledCheckboxFormItem>
      <ControlItems
        filterToEdit={filterToEdit}
        formFilter={formFilter}
        filterId={filterId}
        form={form}
        forceUpdate={forceUpdate}
      />
      <FilterScope
        updateFormValues={(values: any) =>
          setNativeFilterFieldValues(form, filterId, values)
        }
        pathToFormValue={['filters', filterId]}
        forceUpdate={forceUpdate}
        scope={filterToEdit?.scope}
        formScope={formFilter?.scope}
        formScoping={formFilter?.scoping}
      />
    </>
  );
};

export default FiltersConfigForm;
