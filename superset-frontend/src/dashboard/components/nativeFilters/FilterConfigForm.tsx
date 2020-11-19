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
import React, {  Fragment, useEffect, useState } from 'react';
import { styled, SupersetClient, t } from '@superset-ui/core';
import SupersetResourceSelect from 'src/components/SupersetResourceSelect';
import { Form, Input, Radio, Typography } from 'src/common/components';
import { AsyncSelect } from 'src/components/Select';
import { useToasts } from 'src/messageToasts/enhancers/withToasts';
import getClientErrorObject from 'src/utils/getClientErrorObject';
import { DatasetSelectValue, Filter, Scoping } from './types';
import ScopingTree from './ScopingTree';

interface FilterConfigForm {
  setFilterScope: Function;
  dataset: any;
  setDataset: (arg0: DatasetSelectValue) => void;
  filterToEdit?: Filter;
  form: any;
  filterConfigs: any;
  onFormChange: (arg0: any) => any;
}

type ColumnSelectValue = {
  value: string;
  label: string;
};

interface ColumnSelectProps {
  datasetId?: number | null; // ugh why are all the ids numbers
  value?: ColumnSelectValue | null;
  onChange?: (value: ColumnSelectValue) => void;
}

const datasetToSelectOption = (item: any): DatasetSelectValue => ({
  value: item.id,
  label: item.table_name,
});

function ColumnSelect({ datasetId, value, onChange }: ColumnSelectProps) {
  const { addDangerToast } = useToasts();
  function loadOptions() {
    if (datasetId == null) return [];
    return SupersetClient.get({
      endpoint: `/api/v1/dataset/${datasetId}`,
    }).then(
      ({ json: { result } }) => {
        return result.columns.map((col: any) => col.column_name);
      },
      async badResponse => {
        const { error, message } = await getClientErrorObject(badResponse);
        let errorText = message || error || t('An error has occurred');
        if (message === 'Forbidden') {
          errorText = t('You do not have permission to edit this dashboard');
        }
        addDangerToast(errorText);
        return [];
      },
    );
  }
  return (
    <AsyncSelect
      // "key" prop makes react render a new instance of the select whenever the dataset changes
      key={datasetId == null ? '*no dataset*' : datasetId}
      value={value}
      onChange={onChange}
      isMulti={false}
      loadOptions={loadOptions}
      defaultOptions // load options on render
      cacheOptions
    />
  );
}

const ScopingTreeNote = styled.div`
  margin-top: -20px;
  margin-bottom: 10px;
`;

const FilterConfigForm = ({
  dataset,
  setDataset,
  setFilterScope,
  filterToEdit,
  form,
  onFormChange,
}: FilterConfigForm) => {
  const [scoping, setScoping] = useState<Scoping>(Scoping.all);

  useEffect(() => {
    form.setFieldsValue({
      name: filterToEdit?.name,
      column:
        filterToEdit?.targets?.length && filterToEdit.targets[0].datasetId,
    });
  }, [filterToEdit]);
        
  return (
    <Form
      form={form}
      onValuesChange={changes => {
        onFormChange(changes);
        // un-set the "column" value whenever the dataset changes.
        // Doing this in the onChange handler of the
        // dataset selector doesn't work for some reason.
        if ('dataset' in changes && changes.dataset?.value !== dataset?.value) {
          form.setFieldsValue({ column: null });
          setDataset(changes.dataset);
        }
      }}
    >
      <Form.Item
        name="name"
        label="Filter Name"
        initialValue={filterToEdit?.name}
        rules={[{ required: true }]}
      >
        <Input />
      </Form.Item>
      <Form.Item name="dataset" label="Datasource" rules={[{ required: true }]}>
        <SupersetResourceSelect
          resource="dataset"
          searchColumn="table_name"
          transformItem={datasetToSelectOption}
          isMulti={false}
        />
      </Form.Item>
      <Form.Item
        // don't show the column select unless we have a dataset
        style={{ display: dataset ? undefined : 'none' }}
        name="column"
        initialValue={
          filterToEdit?.targets?.length && filterToEdit?.targets[0]?.datasetId
        }
        label="Field"
        rules={[{ required: true }]}
      >
        <ColumnSelect datasetId={dataset?.value} />
      </Form.Item>
      <Form.Item name="defaultValue" label="Default Value">
        <Input />
      </Form.Item>
      <Form.Item name="isInstant" label={t('Apply changes instantly')}>
        <Input type="checkbox" />
      </Form.Item>
      <Form.Item
        name="allowsMultipleValues"
        label={t('Allow multiple selections')}
      >
        <Input type="checkbox" />
      </Form.Item>
      <Form.Item name="isRequired" label={t('Required')}>
        <Input type="checkbox" />
      </Form.Item>
      <Typography.Title level={5}>{t('Scoping')}</Typography.Title>
      <Form.Item name="scoping" initialValue={scoping}>
        <Radio.Group
          onChange={({ target: { value } }) => {
            setScoping(value as Scoping);
          }}
        >
          <Radio value={Scoping.all}>{t('Apply to all panels')}</Radio>
          <Radio value={Scoping.specific}>
            {t('Apply to specific panels')}
          </Radio>
        </Radio.Group>
      </Form.Item>
      {scoping === Scoping.specific && (
        <Fragment>
          <ScopingTreeNote>
            <Typography.Text type="secondary">
              {t('Only selected panels will be affected by this filter')}
            </Typography.Text>
          </ScopingTreeNote>
          <ScopingTree setFilterScope={setFilterScope} />
        </Fragment>
      )}
    </Form>
  );
};

export default FilterConfigForm;
