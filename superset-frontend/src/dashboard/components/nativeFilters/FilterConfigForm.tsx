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
import { styled, t } from '@superset-ui/core';
import { FormInstance } from 'antd/lib/form';
import React, { useCallback, useState } from 'react';
import {
  Button,
  Checkbox,
  Form,
  Input,
  Radio,
  Typography,
} from 'src/common/components';
import { Select } from 'src/components/Select/SupersetStyledSelect';
import SupersetResourceSelect, {
  Value,
} from 'src/components/SupersetResourceSelect';
import { addDangerToast } from 'src/messageToasts/actions';
import { ClientErrorObject } from 'src/utils/getClientErrorObject';
import { ColumnSelect } from './ColumnSelect';
import ScopingTree from './ScopingTree';
import { Filter, NativeFiltersForm, Scoping } from './types';

type DatasetSelectValue = {
  value: number;
  label: string;
};

const datasetToSelectOption = (item: any): DatasetSelectValue => ({
  value: item.id,
  label: item.table_name,
});

const ScopingTreeNote = styled.div`
  margin-bottom: ${({ theme }) => theme.gridUnit * 2}px;
`;

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
  const [advancedScopingOpen, setAdvancedScopingOpen] = useState<Scoping>(
    Scoping.all,
  );
  const [dataset, setDataset] = useState<Value<number> | undefined>();

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

  const setFilterScope = useCallback(
    value => {
      form.setFields([{ name: ['filters', filterId, 'scope'], value }]);
    },
    [form, filterId],
  );

  if (removed) {
    return (
      <RemovedContent>
        <p>{t('You have removed this filter.')}</p>
        <div>
          <Button type="primary" onClick={() => restore(filterId)}>
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
          label={<StyledLabel>{t('Filter Name')}</StyledLabel>}
          initialValue={filterToEdit?.name}
          rules={[{ required: !removed, message: t('Name is required') }]}
          data-test="name-input"
        >
          <Input />
        </StyledFormItem>

        <StyledFormItem
          name={['filters', filterId, 'dataset']}
          label={<StyledLabel>{t('Datasource')}</StyledLabel>}
          rules={[{ required: !removed, message: t('Datasource is required') }]}
          data-test="datasource-input"
        >
          <SupersetResourceSelect
            initialId={filterToEdit?.targets[0].datasetId}
            resource="dataset"
            searchColumn="table_name"
            transformItem={datasetToSelectOption}
            isMulti={false}
            onChange={setDataset}
            onError={onDatasetSelectError}
          />
        </StyledFormItem>
      </StyledContainer>
      <StyledFormItem
        // don't show the column select unless we have a dataset
        // style={{ display: datasetId == null ? undefined : 'none' }}
        name={['filters', filterId, 'column']}
        initialValue={filterToEdit?.targets[0]?.column?.name}
        label={<StyledLabel>{t('Field')}</StyledLabel>}
        rules={[{ required: !removed, message: t('Field is required') }]}
        data-test="field-input"
      >
        <ColumnSelect
          form={form}
          filterId={filterId}
          datasetId={dataset?.value}
        />
      </StyledFormItem>

      <StyledFormItem
        name={['filters', filterId, 'defaultValue']}
        label={<StyledLabel>{t('Default Value')}</StyledLabel>}
        initialValue={filterToEdit?.defaultValue}
      >
        <Input />
      </StyledFormItem>
      <StyledFormItem
        name={['filters', filterId, 'parentFilter']}
        label={<StyledLabel>{t('Parent Filter')}</StyledLabel>}
        initialValue={parentFilterOptions.find(
          ({ value }) => value === filterToEdit?.cascadeParentIds[0],
        )}
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
        <Checkbox>{t('Apply changes instantly')}</Checkbox>
      </StyledCheckboxFormItem>
      <StyledCheckboxFormItem
        name={['filters', filterId, 'allowsMultipleValues']}
        initialValue={filterToEdit?.allowsMultipleValues}
        valuePropName="checked"
        colon={false}
      >
        <Checkbox>{t('Allow multiple selections')}</Checkbox>
      </StyledCheckboxFormItem>
      <StyledCheckboxFormItem
        name={['filters', filterId, 'inverseSelection']}
        initialValue={filterToEdit?.inverseSelection}
        valuePropName="checked"
        colon={false}
      >
        <Checkbox>{t('Inverse selection')}</Checkbox>
      </StyledCheckboxFormItem>
      <StyledCheckboxFormItem
        name={['filters', filterId, 'isRequired']}
        initialValue={filterToEdit?.isRequired}
        valuePropName="checked"
        colon={false}
      >
        <Checkbox>{t('Required')}</Checkbox>
      </StyledCheckboxFormItem>
      <Typography.Title level={5}>{t('Scoping')}</Typography.Title>
      <StyledCheckboxFormItem
        name={['filters', filterId, 'scoping']}
        initialValue={advancedScopingOpen}
      >
        <Radio.Group
          onChange={({ target: { value } }) => {
            setAdvancedScopingOpen(value as Scoping);
          }}
        >
          <Radio value={Scoping.all}>{t('Apply to all panels')}</Radio>
          <Radio value={Scoping.specific}>
            {t('Apply to specific panels')}
          </Radio>
        </Radio.Group>
      </StyledCheckboxFormItem>
      <>
        <ScopingTreeNote>
          <Typography.Text type="secondary">
            {advancedScopingOpen === Scoping.specific
              ? t('Only selected panels will be affected by this filter')
              : t(
                  'All panels with this column will be affected by this filter',
                )}
          </Typography.Text>
        </ScopingTreeNote>
        {advancedScopingOpen === Scoping.specific && (
          <ScopingTree setFilterScope={setFilterScope} />
        )}
      </>
    </>
  );
};

export default FilterConfigForm;
