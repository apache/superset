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
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { findLastIndex, uniq } from 'lodash';
import shortid from 'shortid';
import { DeleteFilled } from '@ant-design/icons';
import { styled, t } from '@superset-ui/core';
import { Form } from 'src/common/components';
import { StyledModal } from 'src/common/components/Modal';
import { LineEditableTabs } from 'src/common/components/Tabs';
import { DASHBOARD_ROOT_ID } from 'src/dashboard/util/constants';
import { usePrevious } from 'src/common/hooks/usePrevious';
import ErrorBoundary from 'src/components/ErrorBoundary';
import { useFilterConfigMap, useFilterConfiguration } from './state';
import FilterConfigForm from './FilterConfigForm';
import { FilterConfiguration, NativeFiltersForm } from './types';

const StyledModalBody = styled.div`
  display: flex;
  flex-direction: row;
  .filters-list {
    width: ${({ theme }) => theme.gridUnit * 50}px;
    overflow: auto;
  }
`;

const RemovedStatus = styled.span`
  &.removed {
    text-decoration: line-through;
  }
`;

function generateFilterId() {
  return `FILTER_V2-${shortid.generate()}`;
}

export interface FilterConfigModalProps {
  isOpen: boolean;
  initialFilterId?: string;
  createNewOnOpen?: boolean;
  save: (filterConfig: FilterConfiguration) => Promise<void>;
  onCancel: () => void;
}

const getFilterIds = (config: FilterConfiguration) =>
  config.map(filter => filter.id);

/**
 * This is the modal to configure all the dashboard-native filters.
 * Manages modal-level state, such as what filters are in the list,
 * and which filter is currently being edited.
 *
 * Calls the `save` callback with the new FilterConfiguration object
 * when the user saves the filters.
 */
export function FilterConfigModal({
  isOpen,
  initialFilterId,
  createNewOnOpen,
  save,
  onCancel,
}: FilterConfigModalProps) {
  const [form] = Form.useForm<NativeFiltersForm>();

  const filterConfig = useFilterConfiguration();
  const filterConfigMap = useFilterConfigMap();
  // new filter ids may belong to filters that do not exist yet
  const [newFilterIds, setNewFilterIds] = useState<string[]>([]);
  // store ids of filters that have been removed but keep them around in the state
  const [removedFilters, setRemovedFilters] = useState<Record<string, boolean>>(
    {},
  );
  const filterIds = useMemo(
    () => uniq([...getFilterIds(filterConfig), ...newFilterIds]),
    [filterConfig, newFilterIds],
  );
  const getInitialCurrentFilterId = useCallback(
    () => initialFilterId ?? filterIds[0],
    [initialFilterId, filterIds],
  );
  const [currentFilterId, setCurrentFilterId] = useState(
    getInitialCurrentFilterId,
  );
  // the form values are managed by the antd form, but we copy them to here
  const [formValues, setFormValues] = useState<NativeFiltersForm>({
    filters: {},
  });
  const wasOpen = usePrevious(isOpen);

  const addFilter = useCallback(() => {
    const newFilterId = generateFilterId();
    setNewFilterIds([...newFilterIds, newFilterId]);
    setCurrentFilterId(newFilterId);
  }, [newFilterIds, setCurrentFilterId]);

  useEffect(() => {
    if (createNewOnOpen && isOpen && !wasOpen) {
      addFilter();
    }
  }, [createNewOnOpen, isOpen, wasOpen, addFilter]);

  const resetForm = useCallback(() => {
    form.resetFields();
    setNewFilterIds([]);
    setCurrentFilterId(getInitialCurrentFilterId());
    setRemovedFilters({});
  }, [form, getInitialCurrentFilterId]);

  function onTabEdit(filterId: string, action: 'add' | 'remove') {
    if (action === 'remove') {
      setRemovedFilters({
        ...removedFilters,
        // trash can button is actually a toggle
        [filterId]: !removedFilters[filterId],
      });
      if (filterId === currentFilterId && !removedFilters[filterId]) {
        // when a filter is removed, switch the view to a non-removed one
        const lastNotRemoved = findLastIndex(
          filterIds,
          id => !removedFilters[id] && id !== filterId,
        );
        if (lastNotRemoved !== -1)
          setCurrentFilterId(filterIds[lastNotRemoved]);
      }
    } else if (action === 'add') {
      addFilter();
    }
  }

  function getFilterTitle(id: string) {
    return (
      formValues.filters[id]?.name ?? filterConfigMap[id]?.name ?? 'New Filter'
    );
  }

  const validateForm = useCallback(async () => {
    try {
      return (await form.validateFields()) as NativeFiltersForm;
    } catch (error) {
      console.warn('Filter Configuration Failed:', error);

      if (!error.errorFields || !error.errorFields.length) return null; // not a validation error

      // the name is in array format since the fields are nested
      type ErrorFields = { name: ['filters', string, string] }[];
      const errorFields = error.errorFields as ErrorFields;
      // filter id is the second item in the field name
      if (!errorFields.some(field => field.name[1] === currentFilterId)) {
        // switch to the first tab that had a validation error
        setCurrentFilterId(errorFields[0].name[1]);
      }
      return null;
    }
  }, [form, currentFilterId]);

  const onOk = useCallback(async () => {
    const values: NativeFiltersForm | null = await validateForm();
    if (values == null) return;

    const newFilterConfig: FilterConfiguration = filterIds
      .filter(id => !removedFilters[id])
      .map(id => {
        // create a filter config object from the form inputs
        const formInputs = values.filters[id];
        // if user didn't open a filter, return the original config
        if (!formInputs) return filterConfigMap[id];
        return {
          id,
          cascadeParentIds: [],
          name: formInputs.name,
          type: 'text',
          // for now there will only ever be one target
          targets: [
            {
              datasetId: formInputs.dataset.value,
              column: {
                name: formInputs.column,
              },
            },
          ],
          defaultValue: formInputs.defaultValue || null,
          scope: {
            rootPath: [DASHBOARD_ROOT_ID],
            excluded: [],
          },
          inverseSelection: !!formInputs.inverseSelection,
          isInstant: !!formInputs.isInstant,
          allowsMultipleValues: !!formInputs.allowsMultipleValues,
          isRequired: !!formInputs.isRequired,
        };
      });

    await save(newFilterConfig);
    resetForm();
  }, [
    save,
    resetForm,
    filterIds,
    removedFilters,
    filterConfigMap,
    validateForm,
  ]);

  return (
    <StyledModal
      visible={isOpen}
      title={t('Filter Configuration and Scoping')}
      width="55%"
      onCancel={() => {
        resetForm();
        onCancel();
      }}
      onOk={onOk}
      okText={t('Save')}
      cancelText={t('Cancel')}
      centered
      data-test="filter-modal"
    >
      <ErrorBoundary>
        <StyledModalBody>
          <Form
            form={form}
            onValuesChange={(changes, values) => {
              if (
                changes.filters &&
                Object.values(changes.filters).some(
                  (filter: any) => filter.name != null,
                )
              ) {
                // we only need to set this if a name changed
                setFormValues(values);
              }
            }}
          >
            <LineEditableTabs
              tabPosition="left"
              onChange={setCurrentFilterId}
              activeKey={currentFilterId}
              onEdit={onTabEdit}
            >
              {filterIds.map(id => (
                <LineEditableTabs.TabPane
                  tab={
                    <RemovedStatus
                      className={removedFilters[id] ? 'removed' : ''}
                    >
                      {getFilterTitle(id)}
                    </RemovedStatus>
                  }
                  key={id}
                  closeIcon={<DeleteFilled />}
                >
                  <FilterConfigForm
                    form={form}
                    filterId={id}
                    filterToEdit={filterConfigMap[id]}
                    removed={!!removedFilters[id]}
                  />
                </LineEditableTabs.TabPane>
              ))}
            </LineEditableTabs>
          </Form>
        </StyledModalBody>
      </ErrorBoundary>
    </StyledModal>
  );
}
