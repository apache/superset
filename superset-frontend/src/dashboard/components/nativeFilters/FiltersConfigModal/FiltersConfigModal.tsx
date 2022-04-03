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
  useEffect,
  useCallback,
  useMemo,
  useState,
  useRef,
} from 'react';
import { uniq, isEqual, sortBy, debounce } from 'lodash';
import {
  Filter,
  FilterConfiguration,
  NativeFilterType,
  Divider,
  styled,
  SLOW_DEBOUNCE,
  t,
} from '@superset-ui/core';
import { AntdForm } from 'src/components';
import ErrorBoundary from 'src/components/ErrorBoundary';
import { StyledModal } from 'src/components/Modal';
import { testWithId } from 'src/utils/testUtils';
import { useFilterConfigMap, useFilterConfiguration } from '../state';
import FilterConfigurePane from './FilterConfigurePane';
import FiltersConfigForm, {
  FilterPanels,
} from './FiltersConfigForm/FiltersConfigForm';
import Footer from './Footer/Footer';
import { useOpenModal, useRemoveCurrentFilter } from './state';
import { FilterRemoval, NativeFiltersForm } from './types';
import {
  createHandleSave,
  createHandleRemoveItem,
  generateFilterId,
  getFilterIds,
  validateForm,
  NATIVE_FILTER_DIVIDER_PREFIX,
  hasCircularDependency,
} from './utils';
import DividerConfigForm from './DividerConfigForm';

const StyledModalWrapper = styled(StyledModal)`
  min-width: 700px;
  .ant-modal-body {
    padding: 0px;
  }
`;

export const StyledModalBody = styled.div`
  display: flex;
  height: 700px;
  flex-direction: row;
  .filters-list {
    width: ${({ theme }) => theme.gridUnit * 50}px;
    overflow: auto;
  }
`;

export const StyledForm = styled(AntdForm)`
  width: 100%;
`;

export const FILTERS_CONFIG_MODAL_TEST_ID = 'filters-config-modal';
export const getFiltersConfigModalTestId = testWithId(
  FILTERS_CONFIG_MODAL_TEST_ID,
);

export interface FiltersConfigModalProps {
  isOpen: boolean;
  initialFilterId?: string;
  createNewOnOpen?: boolean;
  onSave: (filterConfig: FilterConfiguration) => Promise<void>;
  onCancel: () => void;
}
export const ALLOW_DEPENDENCIES = ['filter_select'];

/**
 * This is the modal to configure all the dashboard-native filters.
 * Manages modal-level state, such as what filters are in the list,
 * and which filter is currently being edited.
 *
 * Calls the `save` callback with the new FilterConfiguration object
 * when the user saves the filters.
 */
export function FiltersConfigModal({
  isOpen,
  initialFilterId,
  createNewOnOpen,
  onSave,
  onCancel,
}: FiltersConfigModalProps) {
  const [form] = AntdForm.useForm<NativeFiltersForm>();

  const configFormRef = useRef<any>();

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

  const [saveAlertVisible, setSaveAlertVisible] = useState<boolean>(false);

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
  const initialCurrentFilterId = initialFilterId ?? filterIds[0];
  const [currentFilterId, setCurrentFilterId] = useState(
    initialCurrentFilterId,
  );
  const [erroredFilters, setErroredFilters] = useState<string[]>([]);

  // the form values are managed by the antd form, but we copy them to here
  // so that we can display them (e.g. filter titles in the tab headers)
  const [formValues, setFormValues] = useState<NativeFiltersForm>({
    filters: {},
  });

  const unsavedFiltersIds = newFilterIds.filter(id => !removedFilters[id]);
  // brings back a filter that was previously removed ("Undo")
  const restoreFilter = (id: string) => {
    const removal = removedFilters[id];
    // gotta clear the removal timeout to prevent the filter from getting deleted
    if (removal?.isPending) clearTimeout(removal.timerId);
    setRemovedFilters(current => ({ ...current, [id]: null }));
  };
  const getInitialFilterOrder = () => Object.keys(filterConfigMap);

  // State for tracking the re-ordering of filters
  const [orderedFilters, setOrderedFilters] = useState<string[]>(
    getInitialFilterOrder(),
  );

  const getActiveFilterPanelKey = (filterId: string) => [
    `${filterId}-${FilterPanels.configuration.key}`,
    `${filterId}-${FilterPanels.settings.key}`,
  ];

  const [activeFilterPanelKey, setActiveFilterPanelKey] = useState<
    string | string[]
  >(getActiveFilterPanelKey(initialCurrentFilterId));

  const onTabChange = (filterId: string) => {
    setCurrentFilterId(filterId);
    setActiveFilterPanelKey(getActiveFilterPanelKey(filterId));
  };

  // generates a new filter id and appends it to the newFilterIds
  const addFilter = useCallback(
    (type: NativeFilterType) => {
      const newFilterId = generateFilterId(type);
      setNewFilterIds([...newFilterIds, newFilterId]);
      setCurrentFilterId(newFilterId);
      setSaveAlertVisible(false);
      setOrderedFilters([...orderedFilters, newFilterId]);
      setActiveFilterPanelKey(getActiveFilterPanelKey(newFilterId));
    },
    [
      newFilterIds,
      orderedFilters,
      setCurrentFilterId,
      setOrderedFilters,
      setNewFilterIds,
    ],
  );

  useOpenModal(isOpen, addFilter, createNewOnOpen);

  useRemoveCurrentFilter(
    removedFilters,
    currentFilterId,
    orderedFilters,
    setCurrentFilterId,
  );

  const handleRemoveItem = createHandleRemoveItem(
    setRemovedFilters,
    setOrderedFilters,
    setSaveAlertVisible,
  );

  // After this, it should be as if the modal was just opened fresh.
  // Called when the modal is closed.
  const resetForm = (isSaving = false) => {
    setNewFilterIds([]);
    setCurrentFilterId(initialCurrentFilterId);
    setRemovedFilters({});
    setSaveAlertVisible(false);
    setFormValues({ filters: {} });
    setErroredFilters([]);
    if (filterIds.length > 0) {
      setActiveFilterPanelKey(getActiveFilterPanelKey(filterIds[0]));
    }
    if (!isSaving) {
      setOrderedFilters(getInitialFilterOrder());
    }
    form.resetFields(['filters']);
    form.setFieldsValue({ changed: false });
  };

  const getFilterTitle = useCallback(
    (id: string) => {
      const formValue = formValues.filters[id];
      const config = filterConfigMap[id];
      return (
        (formValue && 'name' in formValue && formValue.name) ||
        (formValue && 'title' in formValue && formValue.title) ||
        (config && 'name' in config && config.name) ||
        (config && 'title' in config && config.title) ||
        t('[untitled]')
      );
    },
    [filterConfigMap, formValues.filters],
  );

  const canBeUsedAsDependency = useCallback(
    (filterId: string) => {
      if (removedFilters[filterId]) {
        return false;
      }
      const component =
        form.getFieldValue('filters')?.[filterId] || filterConfigMap[filterId];
      return (
        component &&
        'filterType' in component &&
        ALLOW_DEPENDENCIES.includes(component.filterType)
      );
    },
    [filterConfigMap, form, removedFilters],
  );

  const getAvailableFilters = useCallback(
    (filterId: string) =>
      filterIds
        .filter(key => key !== filterId)
        .filter(filterId => canBeUsedAsDependency(filterId))
        .map(key => ({
          label: getFilterTitle(key),
          value: key,
        })),
    [canBeUsedAsDependency, filterIds, getFilterTitle],
  );

  const cleanDeletedParents = (values: NativeFiltersForm | null) => {
    Object.keys(filterConfigMap).forEach(key => {
      const filter = filterConfigMap[key];
      if (!('cascadeParentIds' in filter)) {
        return;
      }
      const { cascadeParentIds } = filter;
      if (cascadeParentIds) {
        filter.cascadeParentIds = cascadeParentIds.filter(id =>
          canBeUsedAsDependency(id),
        );
      }
    });

    const filters = values?.filters;
    if (filters) {
      Object.keys(filters).forEach(key => {
        const filter = filters[key];
        if (!('dependencies' in filter)) {
          return;
        }
        const { dependencies } = filter;
        if (dependencies) {
          filter.dependencies = dependencies.filter(id =>
            canBeUsedAsDependency(id),
          );
        }
      });
    }
  };

  const handleErroredFilters = useCallback(() => {
    // managing left pane errored filters indicators
    const formValidationFields = form.getFieldsError();
    const erroredFiltersIds: string[] = [];

    formValidationFields.forEach(field => {
      const filterId = field.name[1] as string;
      if (field.errors.length > 0 && !erroredFiltersIds.includes(filterId)) {
        erroredFiltersIds.push(filterId);
      }
    });

    // no form validation issues found, resets errored filters
    if (!erroredFiltersIds.length && erroredFilters.length > 0) {
      setErroredFilters([]);
      return;
    }
    // form validation issues found, sets errored filters
    if (
      erroredFiltersIds.length > 0 &&
      !isEqual(sortBy(erroredFilters), sortBy(erroredFiltersIds))
    ) {
      setErroredFilters(erroredFiltersIds);
    }
  }, [form, erroredFilters]);

  const handleSave = async () => {
    const values: NativeFiltersForm | null = await validateForm(
      form,
      currentFilterId,
      setCurrentFilterId,
    );

    handleErroredFilters();

    if (values) {
      cleanDeletedParents(values);
      createHandleSave(
        filterConfigMap,
        orderedFilters,
        removedFilters,
        onSave,
        values,
      )();
      resetForm(true);
    } else {
      configFormRef.current.changeTab('configuration');
    }
  };

  const handleConfirmCancel = () => {
    resetForm();
    onCancel();
  };

  const handleCancel = () => {
    const changed = form.getFieldValue('changed');
    const initialOrder = getInitialFilterOrder();
    const didChangeOrder =
      orderedFilters.length !== initialOrder.length ||
      orderedFilters.some((val, index) => val !== initialOrder[index]);
    if (
      unsavedFiltersIds.length > 0 ||
      form.isFieldsTouched() ||
      changed ||
      didChangeOrder
    ) {
      setSaveAlertVisible(true);
    } else {
      handleConfirmCancel();
    }
  };
  const onRearrange = (dragIndex: number, targetIndex: number) => {
    const newOrderedFilter = [...orderedFilters];
    const removed = newOrderedFilter.splice(dragIndex, 1)[0];
    newOrderedFilter.splice(targetIndex, 0, removed);
    setOrderedFilters(newOrderedFilter);
  };

  const buildDependencyMap = useCallback(() => {
    const dependencyMap = new Map<string, string[]>();
    const filters = form.getFieldValue('filters');
    if (filters) {
      Object.keys(filters).forEach(key => {
        const formItem = filters[key];
        const configItem = filterConfigMap[key];
        let array: string[] = [];
        if (formItem && 'dependencies' in formItem) {
          array = [...formItem.dependencies];
        } else if (configItem && configItem.cascadeParentIds) {
          array = [...configItem.cascadeParentIds];
        }
        dependencyMap.set(key, array);
      });
    }
    return dependencyMap;
  }, [filterConfigMap, form]);

  const validateDependencies = () => {
    const dependencyMap = buildDependencyMap();
    filterIds
      .filter(id => !removedFilters[id])
      .forEach(filterId => {
        const result = hasCircularDependency(dependencyMap, filterId);
        const field = {
          name: ['filters', filterId, 'dependencies'],
          errors: result ? [t('Cyclic dependency detected')] : [],
        };
        form.setFields([field]);
      });
    handleErroredFilters();
  };

  const getDependencySuggestion = (filterId: string) => {
    const dependencyMap = buildDependencyMap();
    const possibleDependencies = orderedFilters.filter(
      key => key !== filterId && canBeUsedAsDependency(key),
    );
    const found = possibleDependencies.find(filter => {
      const dependencies = dependencyMap.get(filterId) || [];
      dependencies.push(filter);
      if (hasCircularDependency(dependencyMap, filterId)) {
        dependencies.pop();
        return false;
      }
      return true;
    });
    return found || possibleDependencies[0];
  };

  const onValuesChange = useMemo(
    () =>
      debounce((changes: any, values: NativeFiltersForm) => {
        const didChangeFilterName =
          changes.filters &&
          Object.values(changes.filters).some(
            (filter: any) => filter.name && filter.name !== null,
          );
        const didChangeSectionTitle =
          changes.filters &&
          Object.values(changes.filters).some(
            (filter: any) => filter.title && filter.title !== null,
          );
        if (didChangeFilterName || didChangeSectionTitle) {
          // we only need to set this if a name/title changed
          setFormValues(values);
        }
        setSaveAlertVisible(false);
        handleErroredFilters();
      }, SLOW_DEBOUNCE),
    [handleErroredFilters],
  );

  useEffect(() => {
    setErroredFilters(prevErroredFilters =>
      prevErroredFilters.filter(f => !removedFilters[f]),
    );
  }, [removedFilters]);

  const getForm = (id: string) => {
    const isDivider = id.startsWith(NATIVE_FILTER_DIVIDER_PREFIX);
    return isDivider ? (
      <DividerConfigForm
        componentId={id}
        divider={filterConfigMap[id] as Divider}
      />
    ) : (
      <FiltersConfigForm
        ref={configFormRef}
        form={form}
        filterId={id}
        filterToEdit={filterConfigMap[id] as Filter}
        removedFilters={removedFilters}
        restoreFilter={restoreFilter}
        getAvailableFilters={getAvailableFilters}
        key={id}
        activeFilterPanelKeys={activeFilterPanelKey}
        handleActiveFilterPanelChange={key => setActiveFilterPanelKey(key)}
        isActive={currentFilterId === id}
        setErroredFilters={setErroredFilters}
        validateDependencies={validateDependencies}
        getDependencySuggestion={getDependencySuggestion}
      />
    );
  };

  return (
    <StyledModalWrapper
      visible={isOpen}
      maskClosable={false}
      title={t('Add and edit filters')}
      width="50%"
      destroyOnClose
      onCancel={handleCancel}
      onOk={handleSave}
      centered
      data-test="filter-modal"
      footer={
        <Footer
          onDismiss={() => setSaveAlertVisible(false)}
          onCancel={handleCancel}
          handleSave={handleSave}
          canSave={!erroredFilters.length}
          saveAlertVisible={saveAlertVisible}
          onConfirmCancel={handleConfirmCancel}
        />
      }
    >
      <ErrorBoundary>
        <StyledModalBody>
          <StyledForm
            form={form}
            onValuesChange={onValuesChange}
            layout="vertical"
          >
            <FilterConfigurePane
              erroredFilters={erroredFilters}
              onRemove={handleRemoveItem}
              onAdd={addFilter}
              onChange={onTabChange}
              getFilterTitle={getFilterTitle}
              currentFilterId={currentFilterId}
              removedFilters={removedFilters}
              restoreFilter={restoreFilter}
              onRearrange={onRearrange}
              filters={orderedFilters}
            >
              {(id: string) => getForm(id)}
            </FilterConfigurePane>
          </StyledForm>
        </StyledModalBody>
      </ErrorBoundary>
    </StyledModalWrapper>
  );
}
