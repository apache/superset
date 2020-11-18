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
import { ButtonProps } from 'antd/lib/button';
import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import shortid from 'shortid';
import Button from 'src/components/Button';
import { Form } from 'src/common/components';
import { StyledModal } from 'src/common/components/Modal';
import { createFilter } from 'src/dashboard/actions/nativeFilters';
import { DASHBOARD_ROOT_ID } from 'src/dashboard/util/constants';
import Icon from 'src/components/Icon';
import { DatasetSelectValue } from './types';
import { useFilterConfigurations } from './state';
import FilterConfigForm from './FilterConfigForm';
/** Special purpose AsyncSelect that selects a column from a dataset */

interface FilterCreateModalProps {
  isOpen: boolean;
  save: (values: Record<string, any>) => Promise<void>;
  onCancel: () => void;
}

const FiltersStyle = styled.div`
  display: flex;
  flex-direction: row;
`;

const StyledModalBody = styled.div`
  display: flex;
  flex-direction: row;
  .filters-list {
    width 200px;
    overflow: auto;
  }
`;

const initVals = {
  id: '0',
  name: 'New Filter',
  type: 'text',
  targets: [],
  defaultValue: null,
  scope: {
    excluded: [],
    rootPath: ['ROOT_ID'],
  },
  isInstant: '',
};

function FilterCreateModal({ isOpen, save, onCancel }: FilterCreateModalProps) {
  const [form] = Form.useForm();

  // antd form manages the dataset value,
  // but we track it here so that we can pass it to the column select
  const [dataset, setDataset] = useState<DatasetSelectValue | null>(null);
  const [currentFilter, setCurrentFilter] = useState(0);
  const filterConfigs = useFilterConfigurations();
  const [filters, setFilters] = useState(filterConfigs || [{}]);
  // console.log('filters', filters)
  function resetForm() {
    form.resetFields();
    setDataset(null);
  }
  console.log('filters on load', filters);
  function onFormChange(changes: any) {
    filters[currentFilter] = { ...filters[currentFilter], ...changes };
    setFilters([...filters]);
    console.log('filters onChange form', filters);
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
      <StyledModalBody>
        <div className="filters-list">
          {filters.map((filter, i: number) => (
            <FiltersStyle>
              <Button
                type="link"
                key={filter.name}
                onClick={() => {
                  // setFilterToEdit({ filter, index: i });
                  setCurrentFilter(i);
                  setDataset(
                    filter?.targets.length && filter?.targets[0]?.datasetId,
                  );
                }}
              >
                {filter.name}
              </Button>
              <span
                role="button"
                title="Edit Dashboard"
                tabIndex={0}
                className="delete-config"
                onClick={() => {
                  /* (filter.id) */
                }}
              >
                <Icon name="trash" />
              </span>
            </FiltersStyle>
          ))}
          <div
            role="button"
            title="add filter"
            tabIndex={0}
            onClick={() => {
              filters.push(initVals);
              setFilters(filters);
              setCurrentFilter(filters.length - 1);
            }}
          >
            <Icon name="plus" />
          </div>
        </div>
        <FilterConfigForm
          dataset={dataset}
          setDataset={setDataset}
          form={form}
          filterToEdit={filters[currentFilter]}
          onFormChange={onFormChange}
        />
      </StyledModalBody>
    </StyledModal>
  );
}

function generateFilterId() {
  return `FILTER_V2-${shortid.generate()}`;
}

const CreateFilterButton: React.FC<ButtonProps> = ({
  children,
  ...buttonProps
}) => {
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
      <Button {...buttonProps} onClick={() => setOpen(true)}>
        {children}
      </Button>
      <FilterCreateModal isOpen={isOpen} save={submit} onCancel={close} />
    </>
  );
};

export default CreateFilterButton;
