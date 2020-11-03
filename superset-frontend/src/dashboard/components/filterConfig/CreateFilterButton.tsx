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
import { SupersetClient, t } from '@superset-ui/core';
import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import shortid from 'shortid';
import { Button, Form, Input } from 'src/common/components';
import { StyledModal } from 'src/common/components/Modal';
import { AsyncSelect } from 'src/components/Select';
import SupersetResourceSelect from 'src/components/SupersetResourceSelect';
import { createFilter } from 'src/dashboard/actions/filterConfiguration';
import { DASHBOARD_ROOT_ID } from 'src/dashboard/util/constants';
import { useToasts } from 'src/messageToasts/enhancers/withToasts';
import getClientErrorObject from 'src/utils/getClientErrorObject';

type ColumnSelectValue = {
  value: string;
  label: string;
};

interface ColumnSelectProps {
  datasetId?: number | null; // ugh why are all the ids numbers
  value?: ColumnSelectValue | null;
  onChange?: (value: ColumnSelectValue) => void;
}

/** Special purpose AsyncSelect that selects a column from a dataset */
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

interface FilterCreateFormProps {
  isOpen: boolean;
  save: (values: Record<string, any>) => Promise<void>;
  onCancel: () => void;
}

type DatasetSelectValue = {
  value: number;
  label: string;
};

const datasetToSelectOption = (item: any): DatasetSelectValue => ({
  value: item.id,
  label: item.table_name,
});

function FilterCreateForm({ isOpen, save, onCancel }: FilterCreateFormProps) {
  const [form] = Form.useForm();

  // antd form manages the dataset value,
  // but we track it here so that we can pass it to the column select
  const [dataset, setDataset] = useState<DatasetSelectValue | null>(null);

  function resetForm() {
    form.resetFields();
    setDataset(null);
  }

  return (
    <StyledModal
      visible={isOpen}
      title={t('Filter Configuration and Scoping')}
      onCancel={() => {
        resetForm();
        onCancel();
      }}
      onOk={async () => {
        let values = {};
        try {
          values = await form.validateFields();
        } catch (info) {
          console.log('Validate Failed:', info);
        }
        await save(values);
        resetForm();
      }}
      okText={t('Save')}
      cancelText={t('Cancel')}
    >
      <Form
        form={form}
        onValuesChange={changes => {
          // un-set the "column" value whenever the dataset changes.
          // Doing this in the onChange handler of the
          // dataset selector doesn't work for some reason.
          if (
            'dataset' in changes &&
            changes.dataset?.value !== dataset?.value
          ) {
            form.setFieldsValue({ column: null });
            setDataset(changes.dataset);
          }
        }}
      >
        <Form.Item name="name" label="Filter Name" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Form.Item
          name="dataset"
          label="Datasource"
          rules={[{ required: true }]}
        >
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
      </Form>
    </StyledModal>
  );
}

function generateFilterId() {
  return `FILTER_V2-${shortid.generate()}`;
}

export default function CreateFilterTrigger({
  children,
}: React.PropsWithChildren<{}>) {
  const [isOpen, setOpen] = useState(false);
  const dispatch = useDispatch();

  function close() {
    setOpen(false);
  }

  async function submit(values: Record<string, any>) {
    dispatch(
      createFilter({
        id: generateFilterId(),
        name: values.name,
        type: 'text',
        // for now there will only ever be one target
        targets: [
          {
            datasetId: values.dataset.value,
            column: values.column.value,
          },
        ],
        defaultValue: values.defaultValue,
        scope: {
          rootPath: [DASHBOARD_ROOT_ID],
          excluded: [],
        },
        isInstant: values.isInstant,
      }),
    );
    close();
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>{children}</Button>
      <FilterCreateForm isOpen={isOpen} save={submit} onCancel={close} />
    </>
  );
}
