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
  Checkbox,
  Form,
  Input,
  Radio,
  Typography,
} from 'src/common/components';
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
  margin-top: ${({ theme }) => theme.gridUnit * -5}px;
  margin-bottom: ${({ theme }) => theme.gridUnit * 2}px;
`;

const RemovedContent = styled.div`
  display: flex;
  height: 400px; // arbitrary
  text-align: center;
  justify-content: center;
  align-items: center;
  color: ${({ theme }) => theme.colors.grayscale.base};
`;

export interface FilterConfigFormProps {
  filterId: string;
  filterToEdit?: Filter;
  removed?: boolean;
  form: FormInstance<NativeFiltersForm>;
}

/**
 * The configuration form for a specific filter.
 * Assigns field values to `filters[filterId]` in the form.
 */
export const FilterConfigForm: React.FC<FilterConfigFormProps> = ({
  filterId,
  filterToEdit,
  removed,
  form,
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
        {t(
          'You have removed this filter. Click the trash again to bring it back.',
        )}
      </RemovedContent>
    );
  }

  return (
    <>
      <Form.Item
        name={['filters', filterId, 'name']}
        label={t('Filter Name')}
        initialValue={filterToEdit?.name}
        rules={[{ required: !removed, message: t('Name is required') }]}
        data-test="name-input"
      >
        <Input />
      </Form.Item>
      <Form.Item
        name={['filters', filterId, 'dataset']}
        label={t('Datasource')}
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
      </Form.Item>
      <Form.Item
        // don't show the column select unless we have a dataset
        // style={{ display: datasetId == null ? undefined : 'none' }}
        name={['filters', filterId, 'column']}
        initialValue={filterToEdit?.targets[0]?.column?.name}
        label={t('Field')}
        rules={[{ required: !removed, message: t('Field is required') }]}
        data-test="field-input"
      >
        <ColumnSelect
          form={form}
          filterId={filterId}
          datasetId={dataset?.value}
        />
      </Form.Item>
      <Form.Item
        name={['filters', filterId, 'defaultValue']}
        label={t('Default Value')}
        initialValue={filterToEdit?.defaultValue}
      >
        <Input />
      </Form.Item>
      <Form.Item
        name={['filters', filterId, 'isInstant']}
        label={t('Apply changes instantly')}
        initialValue={filterToEdit?.isInstant}
        valuePropName="checked"
      >
        <Checkbox />
      </Form.Item>
      <Form.Item
        name={['filters', filterId, 'allowsMultipleValues']}
        label={t('Allow multiple selections')}
        initialValue={filterToEdit?.allowsMultipleValues}
        valuePropName="checked"
      >
        <Checkbox />
      </Form.Item>
      <Form.Item
        name={['filters', filterId, 'inverseSelection']}
        label={t('Inverse selection')}
        initialValue={filterToEdit?.inverseSelection}
        valuePropName="checked"
      >
        <Checkbox />
      </Form.Item>
      <Form.Item
        name={['filters', filterId, 'isRequired']}
        label={t('Required')}
        initialValue={filterToEdit?.isRequired}
        valuePropName="checked"
      >
        <Checkbox />
      </Form.Item>
      <Typography.Title level={5}>{t('Scoping')}</Typography.Title>
      <Form.Item
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
      </Form.Item>
      {advancedScopingOpen === Scoping.specific && (
        <>
          <ScopingTreeNote>
            <Typography.Text type="secondary">
              {t('Only selected panels will be affected by this filter')}
            </Typography.Text>
          </ScopingTreeNote>
          <ScopingTree setFilterScope={setFilterScope} />
        </>
      )}
    </>
  );
};

export default FilterConfigForm;
