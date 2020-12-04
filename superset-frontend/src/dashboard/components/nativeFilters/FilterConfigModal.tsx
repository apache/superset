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
import React, {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useState,
} from 'react';
import { useDispatch } from 'react-redux';
import { keyframes } from '@emotion/react';
import { findLastIndex, uniq } from 'lodash';
import shortid from 'shortid';
import { Store } from 'antd/lib/form/interface';
import { DeleteFilled } from '@ant-design/icons';
import { css, styled, t } from '@superset-ui/core';
import { Button, Form } from 'src/common/components';
import Icon from 'src/components/Icon';
import { StyledModal } from 'src/common/components/Modal';
import { LineEditableTabs } from 'src/common/components/Tabs';
import { DASHBOARD_ROOT_ID } from 'src/dashboard/util/constants';
import { usePrevious } from 'src/common/hooks/usePrevious';
import { useFilterConfigMap, useFilterConfiguration } from './state';
import FilterConfigForm from './FilterConfigForm';
import {
  Filter,
  FilterConfiguration,
  NativeFiltersForm,
  Scope,
  Scoping,
} from './types';

// how long to show the "undo" button when removing a filter
const REMOVAL_DELAY_SECS = 5;

const StyledModalBody = styled.div`
  display: flex;
  flex-direction: row;
  .filters-list {
    width 200px;
    overflow: auto;
  }
`;

const StyledForm = styled(Form)`
  width: 100%;
`;

const FilterTabs = styled(LineEditableTabs)`
  // extra selector specificity:
  &.ant-tabs-card > .ant-tabs-nav .ant-tabs-tab {
    min-width: 200px;
    margin-left: 0;
    padding: 0;
    padding-bottom: ${({ theme }) => theme.gridUnit}px;
  }

  .ant-tabs-tab-btn {
    text-align: left;
    justify-content: space-between;
    text-transform: unset;
  }
`;

const tabTitleRemovalAnimation = keyframes`
  0%, 90% {
    opacity: 1;
  }
  95%, 100% {
    opacity: 0;
  }
`;

const FilterTabTitle = styled.span`
  transition: color ${({ theme }) => theme.transitionTiming}s;
  width: 100%;
  display: flex;
  flex-direction: row;
  justify-content: space-between;

  &.removed {
    color: ${({ theme }) => theme.colors.warning.dark1};
    transform-origin: top;
    animation: ${tabTitleRemovalAnimation} ${REMOVAL_DELAY_SECS}s;
  }
`;

type FilterRemoval =
  | null
  | {
      isPending: true; // the filter sticks around for a moment before removal is finalized
      timerId: number; // id of the timer that finally removes the filter
    }
  | { isPending: false };

function generateFilterId() {
  return `NATIVE_FILTER-${shortid.generate()}`;
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
 * Modal for management of dashboard-native filters.
 * Filters can be created, edited, and deleted.
 * No changes are saved until the "save" button is pressed,
 * at which time the updates will be batched.
 */
export function FilterConfigModal({
  isOpen,
  initialFilterId,
  createNewOnOpen,
  save,
  onCancel,
}: FilterConfigModalProps) {
  const [form] = Form.useForm<NativeFiltersForm>();

  // the filter config from redux state, this does not change until modal is closed.
  const filterConfig = useFilterConfiguration();
  const filterConfigMap = useFilterConfigMap();

  // new filter ids belong to filters have been added during
  // this configuration session, and only exist in the form state until we submit.
  const [newFilterIds, setNewFilterIds] = useState<string[]>([]);

  // store ids of filters that have been removed with the time they were removed
  // so that we can disappear them after a few secs.
  // filters are still kept in state until form is submitted.
  const [removedFilters, setRemovedFilters] = useState<
    Record<string, FilterRemoval>
  >({});

  // brings back a filter that was previously removed ("Undo")
  const restoreFilter = useCallback(
    (id: string) => {
      const removal = removedFilters[id];
      // gotta clear the removal timeout to prevent the filter from getting deleted
      if (removal?.isPending) clearTimeout(removal.timerId);
      setRemovedFilters(current => ({ ...current, [id]: null }));
    },
    [removedFilters],
  );

  // The full ordered set of ((original + new) - completely removed) filter ids
  // Use this as the canonical list of what filters are being configured!
  // This includes filter ids that are pending removal, so check for that.
  const filterIds = useMemo(
    () =>
      uniq([...getFilterIds(filterConfig), ...newFilterIds]).filter(
        id => !removedFilters[id] || removedFilters[id]?.isPending,
      ),
    [filterConfig, newFilterIds, removedFilters],
  );

  // open the first filter in the list to start
  const getInitialCurrentFilterId = useCallback(
    () => initialFilterId ?? filterIds[0],
    [initialFilterId, filterIds],
  );
  const [currentFilterId, setCurrentFilterId] = useState(
    getInitialCurrentFilterId,
  );

  // the form values are managed by the antd form, but we copy them to here
  // so that we can display them (e.g. filter titles in the tab headers)
  const [formValues, setFormValues] = useState<NativeFiltersForm>({
    filters: {},
  });

  const wasOpen = usePrevious(isOpen);

  useEffect(() => {
    // if the currently viewed filter is fully removed, change to another tab
    const currentFilterRemoved = removedFilters[currentFilterId];
    if (currentFilterRemoved && !currentFilterRemoved.isPending) {
      const nextFilterIndex = findLastIndex(
        filterIds,
        id => !removedFilters[id] && id !== currentFilterId,
      );
      if (nextFilterIndex !== -1)
        setCurrentFilterId(filterIds[nextFilterIndex]);
    }
  }, [currentFilterId, removedFilters, filterIds]);

  // generates a new filter id and appends it to the newFilterIds
  const addFilter = useCallback(() => {
    const newFilterId = generateFilterId();
    setNewFilterIds([...newFilterIds, newFilterId]);
    setCurrentFilterId(newFilterId);
  }, [newFilterIds, setCurrentFilterId]);

  // if this is a "create" modal rather than an "edit" modal,
  // add a filter on modal open
  useEffect(() => {
    if (createNewOnOpen && isOpen && !wasOpen) {
      addFilter();
    }
  }, [createNewOnOpen, isOpen, wasOpen, addFilter]);

  // After this, it should be as if the modal was just opened fresh.
  // Called when the modal is closed.
  const resetForm = useCallback(() => {
    form.resetFields();
    setNewFilterIds([]);
    setCurrentFilterId(getInitialCurrentFilterId());
    setRemovedFilters({});
  }, [form, getInitialCurrentFilterId]);

  const completeFilterRemoval = (filterId: string) => {
    // the filter state will actually stick around in the form,
    // and the filterConfig/newFilterIds, but we use removedFilters
    // to mark it as removed.
    setRemovedFilters(removedFilters => ({
      ...removedFilters,
      [filterId]: { isPending: false },
    }));
  };

  function onTabEdit(filterId: string, action: 'add' | 'remove') {
    if (action === 'remove') {
      // first set up the timer to completely remove it
      const timerId = window.setTimeout(
        () => completeFilterRemoval(filterId),
        REMOVAL_DELAY_SECS * 1000,
      );
      // mark the filter state as "removal in progress"
      setRemovedFilters(removedFilters => ({
        ...removedFilters,
        [filterId]: { isPending: true, timerId },
      }));
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
        const filterError = errorFields.find(
          field => field.name[0] === 'filters',
        );
        if (filterError) {
          setCurrentFilterId(filterError.name[1]);
        }
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
    >
      <StyledModalBody>
        <StyledForm
          form={form}
          onValuesChange={(changes, values: NativeFiltersForm) => {
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
          <FilterTabs
            tabPosition="left"
            onChange={setCurrentFilterId}
            activeKey={currentFilterId}
            onEdit={onTabEdit}
          >
            {filterIds.map(id => (
              <LineEditableTabs.TabPane
                tab={
                  <FilterTabTitle
                    className={removedFilters[id] ? 'removed' : ''}
                  >
                    <div>
                      {removedFilters[id] ? t('(Removed)') : getFilterTitle(id)}
                    </div>
                    {removedFilters[id] && (
                      <a
                        role="button"
                        tabIndex={0}
                        onClick={() => restoreFilter(id)}
                      >
                        {t('Undo?')}
                      </a>
                    )}
                  </FilterTabTitle>
                }
                key={id}
                closeIcon={removedFilters[id] ? <></> : <DeleteFilled />}
              >
                <FilterConfigForm
                  form={form}
                  filterId={id}
                  filterToEdit={filterConfigMap[id]}
                  removed={!!removedFilters[id]}
                  restore={restoreFilter}
                />
              </LineEditableTabs.TabPane>
            ))}
          </FilterTabs>
        </StyledForm>
      </StyledModalBody>
    </StyledModal>
  );
}
