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
import { DeleteFilled, PlusOutlined } from '@ant-design/icons';
import { styled, t } from '@superset-ui/core';
import { Form } from 'src/common/components';
import { StyledModal } from 'src/common/components/Modal';
import Button from 'src/components/Button';
import { LineEditableTabs } from 'src/common/components/Tabs';
import { DASHBOARD_ROOT_ID } from 'src/dashboard/util/constants';
import { usePrevious } from 'src/common/hooks/usePrevious';
import ErrorBoundary from 'src/components/ErrorBoundary';
import { useFilterConfigMap, useFilterConfiguration } from './state';
import FilterConfigForm from './FilterConfigForm';
import { FilterConfiguration, NativeFiltersForm } from './types';

// how long to show the "undo" button when removing a filter
const REMOVAL_DELAY_SECS = 5;

const StyledModalBody = styled.div`
  display: flex;
  flex-direction: row;
  .filters-list {
    width: ${({ theme }) => theme.gridUnit * 50}px;
    overflow: auto;
  }
`;

const StyledForm = styled(Form)`
  width: 100%;
`;

const StyledSpan = styled.span`
  cursor: pointer;
  color: ${({ theme }) => theme.colors.primary.dark1};
  &: hover {
    color: ${({ theme }) => theme.colors.primary.dark2};
  }
`;

const FilterTabs = styled(LineEditableTabs)`
  // extra selector specificity:
  &.ant-tabs-card > .ant-tabs-nav .ant-tabs-tab {
    min-width: 200px;
    margin-left: 0;
    padding: 0 ${({ theme }) => theme.gridUnit * 2}px
      ${({ theme }) => theme.gridUnit}px;

    &:hover,
    &-active {
      color: ${({ theme }) => theme.colors.grayscale.dark1};
      border-radius: ${({ theme }) => theme.borderRadius}px;
      background-color: ${({ theme }) => theme.colors.grayscale.light2};
    }
  }

  .ant-tabs-tab-btn {
    text-align: left;
    justify-content: space-between;
    text-transform: unset;
  }
`;

const FilterTabTitle = styled.span`
  transition: color ${({ theme }) => theme.transitionTiming}s;
  width: 100%;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  padding: ${({ theme }) => theme.gridUnit}px
    ${({ theme }) => theme.gridUnit * 2}px 0 0;

  @keyframes tabTitleRemovalAnimation {
    0%,
    90% {
      opacity: 1;
    }
    95%,
    100% {
      opacity: 0;
    }
  }

  &.removed {
    color: ${({ theme }) => theme.colors.warning.dark1};
    transform-origin: top;
    animation-name: tabTitleRemovalAnimation;
    animation-duration: ${REMOVAL_DELAY_SECS}s;
  }
`;

const StyledAddFilterBox = styled.div`
  color: ${({ theme }) => theme.colors.primary.dark1};
  text-align: left;
  padding: ${({ theme }) => theme.gridUnit * 2}px 0;
  margin: ${({ theme }) => theme.gridUnit * 3}px 0 0
    ${({ theme }) => -theme.gridUnit * 2}px;
  border-top: 1px solid ${({ theme }) => theme.colors.grayscale.light1};

  &:hover {
    color: ${({ theme }) => theme.colors.primary.base};
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

  function getParentFilters(id: string) {
    return filterIds
      .filter(filterId => filterId !== id && !removedFilters[filterId])
      .map(id => ({
        id,
        title: getFilterTitle(id),
      }));
  }

  const addValidationError = (
    filterId: string,
    field: string,
    error: string,
  ) => {
    const fieldError = {
      name: ['filters', filterId, field],
      errors: [error],
    };
    form.setFields([fieldError]);
    // eslint-disable-next-line no-throw-literal
    throw { errorFields: [fieldError] };
  };

  const validateForm = useCallback(async () => {
    try {
      const formValues = (await form.validateFields()) as NativeFiltersForm;

      const validateInstant = (filterId: string) => {
        const isInstant = formValues.filters[filterId]
          ? formValues.filters[filterId].isInstant
          : filterConfigMap[filterId]?.isInstant;
        if (!isInstant) {
          addValidationError(
            filterId,
            'isInstant',
            'For parent filters changes must be applied instantly',
          );
        }
      };

      const validateCycles = (filterId: string, trace: string[] = []) => {
        if (trace.includes(filterId)) {
          addValidationError(
            filterId,
            'parentFilter',
            'Cannot create cyclic hierarchy',
          );
        }
        const parentId = formValues.filters[filterId]
          ? formValues.filters[filterId].parentFilter?.value
          : filterConfigMap[filterId]?.cascadeParentIds?.[0];
        if (parentId) {
          validateInstant(parentId);
          validateCycles(parentId, [...trace, filterId]);
        }
      };

      filterIds
        .filter(id => !removedFilters[id])
        .forEach(filterId => validateCycles(filterId));

      return formValues;
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
  }, [form, currentFilterId, filterConfigMap, filterIds, removedFilters]);

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
          cascadeParentIds: formInputs.parentFilter
            ? [formInputs.parentFilter.value]
            : [],
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

  const handleCancel = () => {
    resetForm();
    onCancel();
  };

  return (
    <StyledModal
      visible={isOpen}
      title={t('Filter Configuration and Scoping')}
      width="55%"
      onCancel={handleCancel}
      onOk={onOk}
      centered
      data-test="filter-modal"
      footer={[
        <Button key="cancel" buttonStyle="secondary" onClick={handleCancel}>
          {t('Cancel')}
        </Button>,
        <Button key="submit" buttonStyle="primary" onClick={onOk}>
          {t('Save')}
        </Button>,
      ]}
    >
      <ErrorBoundary>
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
            layout="vertical"
          >
            <FilterTabs
              tabPosition="left"
              onChange={setCurrentFilterId}
              activeKey={currentFilterId}
              onEdit={onTabEdit}
              addIcon={
                <StyledAddFilterBox>
                  <PlusOutlined /> <span>{t('Add Filter')}</span>
                </StyledAddFilterBox>
              }
            >
              {filterIds.map(id => (
                <LineEditableTabs.TabPane
                  tab={
                    <FilterTabTitle
                      className={removedFilters[id] ? 'removed' : ''}
                    >
                      <div>
                        {removedFilters[id]
                          ? t('(Removed)')
                          : getFilterTitle(id)}
                      </div>
                      {removedFilters[id] && (
                        <StyledSpan
                          role="button"
                          tabIndex={0}
                          onClick={() => restoreFilter(id)}
                        >
                          {t('Undo?')}
                        </StyledSpan>
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
                    parentFilters={getParentFilters(id)}
                  />
                </LineEditableTabs.TabPane>
              ))}
            </FilterTabs>
          </StyledForm>
        </StyledModalBody>
      </ErrorBoundary>
    </StyledModal>
  );
}
