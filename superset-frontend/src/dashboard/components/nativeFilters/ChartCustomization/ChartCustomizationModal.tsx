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
import { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { t, useTheme } from '@superset-ui/core';
import { useSelector } from 'react-redux';
import { isEmpty, isEqual, sortBy, debounce } from 'lodash';
import { Form } from '@superset-ui/core/components';
import type {
  DatasourcesState,
  ChartsState,
  RootState,
} from 'src/dashboard/types';
import { DatasetSelectLabel } from 'src/features/datasets/DatasetSelectLabel';
import { mostUsedDataset } from '../FiltersConfigModal/FiltersConfigForm/utils';
import ChartCustomizationTitlePane from './ChartCustomizationTitlePane';
import ChartCustomizationForm from './ChartCustomizationForm';
import { createDefaultChartCustomizationItem } from './utils';
import { ChartCustomizationItem } from './types';
import RemovedFilter from '../FiltersConfigModal/FiltersConfigForm/RemovedFilter';
import { selectChartCustomizationItems } from './selectors';
import { BaseConfigModal } from '../ConfigModal/BaseConfigModal';

export interface ChartCustomizationModalProps {
  isOpen: boolean;
  dashboardId: number;
  chartId?: number;
  initialItemId?: string;
  onCancel: () => void;
  onSave: (dashboardId: number, items: ChartCustomizationItem[]) => void;
}

const ChartCustomizationModal = ({
  isOpen,
  dashboardId,
  chartId,
  initialItemId,
  onCancel,
  onSave,
}: ChartCustomizationModalProps) => {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);
  const [form] = Form.useForm();
  const [items, setItems] = useState<ChartCustomizationItem[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [saveAlertVisible, setSaveAlertVisible] = useState(false);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [removedItems, setRemovedItems] = useState<
    Record<string, { isPending: boolean; timerId?: number } | null>
  >({});

  const [itemChanges, setItemChanges] = useState<{
    modified: string[];
    deleted: string[];
    reordered: string[];
  }>({
    modified: [],
    deleted: [],
    reordered: [],
  });

  const resetItemChanges = () => {
    setItemChanges({
      modified: [],
      deleted: [],
      reordered: [],
    });
  };

  const [erroredItems, setErroredItems] = useState<string[]>([]);

  const hasUnsavedChanges = useCallback(() => {
    const changed = form.getFieldValue('changed');
    const isFieldsTouched = form.isFieldsTouched();
    const hasNewItems = items.some(item => !item.id.startsWith('existing_'));
    const hasRemovedItems = items.some(item => item.removed);

    return changed || isFieldsTouched || hasNewItems || hasRemovedItems;
  }, [form, items]);

  const validateForm = useCallback(async () => {
    try {
      const values = await form.validateFields();
      setErroredItems([]);
      return values;
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'errorFields' in error) {
        const { errorFields } = error as {
          errorFields: Array<{ name: (string | number)[] }>;
        };
        const errorItemIds = errorFields
          .map(field => field.name[1])
          .filter(
            (id: string | number) =>
              id && items.some(item => item.id === String(id)),
          )
          .map(String);
        setErroredItems(errorItemIds);
      }
      return null;
    }
  }, [form, items]);

  const handleErroredItems = useCallback(() => {
    const formValidationFields = form.getFieldsError();
    const erroredItemIds: string[] = [];

    formValidationFields.forEach(field => {
      const itemId = field.name[1] as string;
      if (field.errors.length > 0 && !erroredItemIds.includes(itemId)) {
        erroredItemIds.push(itemId);
      }
    });

    if (!erroredItemIds.length && erroredItems.length > 0) {
      setErroredItems([]);
      return;
    }
    if (
      erroredItemIds.length > 0 &&
      !isEqual(sortBy(erroredItems), sortBy(erroredItemIds))
    ) {
      setErroredItems(erroredItemIds);
    }
  }, [form, erroredItems]);

  const resetForm = useCallback(
    (isSaving = false) => {
      setItems([]);
      setCurrentId(null);
      setSaveAlertVisible(false);
      setInitialLoadComplete(false);
      setErroredItems([]);

      if (!isSaving) {
        form.resetFields();
        form.setFieldsValue({ changed: false });
      }
    },
    [form],
  );

  const handleSave = useCallback(async () => {
    const values = await validateForm();

    if (values) {
      const updatedItems = items.map(item => {
        const formItemValues = values.filters?.[item.id] || {};
        const isDeleted = itemChanges.deleted.includes(item.id);

        return {
          ...item,
          removed: isDeleted,
          customization: {
            ...item.customization,
            ...formItemValues,
            dataset: formItemValues.dataset
              ? typeof formItemValues.dataset === 'object' &&
                'value' in formItemValues.dataset
                ? formItemValues.dataset.value
                : formItemValues.dataset
              : item.customization.dataset,
          },
        };
      });

      onSave(dashboardId, updatedItems);
      resetForm(true);
      resetItemChanges();
      onCancel();
    } else if (erroredItems.length > 0) {
      setCurrentId(erroredItems[0]);
    }
  }, [
    validateForm,
    items,
    itemChanges,
    onSave,
    dashboardId,
    resetForm,
    resetItemChanges,
    onCancel,
    erroredItems,
  ]);

  const handleConfirmCancel = useCallback(() => {
    resetForm();
    onCancel();
  }, [resetForm, onCancel]);

  const handleCancel = useCallback(() => {
    if (hasUnsavedChanges()) {
      setSaveAlertVisible(true);
    } else {
      handleConfirmCancel();
    }
  }, [hasUnsavedChanges, handleConfirmCancel]);

  const existingItems = useSelector(selectChartCustomizationItems);

  const loadedDatasets = useSelector<RootState, DatasourcesState>(
    ({ datasources }) => datasources,
  );
  const charts = useSelector<RootState, ChartsState>(({ charts }) => charts);

  const addItem = useCallback(() => {
    const fallbackDatasetId = mostUsedDataset(loadedDatasets, charts);
    const item = createDefaultChartCustomizationItem(
      chartId,
      fallbackDatasetId,
    );
    setItems([...items, item]);
    setCurrentId(item.id);

    const currentFormValues = form.getFieldsValue();
    let formattedDataset = null;

    if (fallbackDatasetId) {
      const datasetInfo = Object.values(loadedDatasets).find(
        dataset => dataset.id === Number(fallbackDatasetId),
      );

      formattedDataset = datasetInfo
        ? {
            value: fallbackDatasetId,
            label: DatasetSelectLabel({
              id: Number(fallbackDatasetId),
              table_name: datasetInfo.table_name || '',
              schema: datasetInfo.schema || '',
              database: {
                database_name:
                  (datasetInfo.database?.database_name as string) ||
                  (datasetInfo.database?.name as string) ||
                  '',
              },
            }),
            table_name: datasetInfo.table_name,
            schema: datasetInfo.schema,
          }
        : {
            value: fallbackDatasetId,
            label: `Dataset ${fallbackDatasetId}`,
          };
    }

    form.setFieldsValue({
      filters: {
        ...currentFormValues.filters,
        [item.id]: {
          name: '',
          description: '',
          dataset: formattedDataset,
          column: null,
          sortFilter: false,
          sortAscending: true,
          sortMetric: null,
          hasDefaultValue: false,
          isRequired: false,
          selectFirst: false,
        },
      },
    });
  }, [items, chartId, loadedDatasets, charts, form]);

  const restoreItem = useCallback(
    (id: string) => {
      const removal = removedItems[id];
      if (removal?.isPending && removal.timerId) {
        clearTimeout(removal.timerId);
      }

      setRemovedItems(current => ({ ...current, [id]: null }));

      setItemChanges(prev => ({
        ...prev,
        deleted: prev.deleted.filter(deletedId => deletedId !== id),
      }));
    },
    [removedItems],
  );

  const handleRemoveItem = useCallback(
    (id: string) => {
      const completeItemRemoval = (itemId: string) => {
        setRemovedItems(removedItems => ({
          ...removedItems,
          [itemId]: { isPending: false },
        }));
      };

      const timerId = window.setTimeout(() => {
        completeItemRemoval(id);
      }, 3000);

      setRemovedItems(removedItems => ({
        ...removedItems,
        [id]: { isPending: true, timerId },
      }));

      setItemChanges(prev => ({
        ...prev,
        deleted: [...prev.deleted, id],
      }));

      setSaveAlertVisible(false);
    },
    [removedItems],
  );

  useEffect(() => {
    const currentItemRemoved = removedItems[currentId || ''];
    if (currentItemRemoved && !currentItemRemoved.isPending) {
      const nextItem = items.find(
        item => !removedItems[item.id] && item.id !== currentId,
      );
      setCurrentId(nextItem?.id || null);
    }
  }, [currentId, removedItems, items]);

  const handleValuesChange = useMemo(
    () =>
      debounce(() => {
        setSaveAlertVisible(false);
        handleErroredItems();
      }, 1000),
    [handleErroredItems],
  );

  const handleToggleExpand = useCallback(() => {
    setExpanded(!expanded);
  }, [expanded]);

  useEffect(() => {
    if (isOpen && !initialLoadComplete) {
      form.resetFields();
      resetItemChanges();

      if (existingItems && existingItems.length > 0) {
        setItems(existingItems);

        const initialItem = initialItemId
          ? existingItems.find(item => item.id === initialItemId)
          : existingItems[0];

        const selectedItemId = initialItem?.id || existingItems[0].id;
        setCurrentId(selectedItemId);

        const formFilters: Record<string, any> = {};
        existingItems.forEach(item => {
          const datasetId = item.customization.dataset;
          const datasetInfo = datasetId
            ? Object.values(loadedDatasets).find(
                dataset => dataset.id === Number(datasetId),
              )
            : null;

          formFilters[item.id] = {
            ...item.customization,
            dataset: datasetId
              ? typeof datasetId === 'object'
                ? datasetId
                : datasetInfo
                  ? {
                      value: datasetId,
                      label: DatasetSelectLabel({
                        id: Number(datasetId),
                        table_name: datasetInfo.table_name || '',
                        schema: datasetInfo.schema || '',
                        database: {
                          database_name:
                            (datasetInfo.database?.database_name as string) ||
                            (datasetInfo.database?.name as string) ||
                            '',
                        },
                      }),
                      table_name: datasetInfo.table_name,
                      schema: datasetInfo.schema,
                    }
                  : {
                      value: datasetId,
                      label: `Dataset ${datasetId}`,
                    }
              : null,
          };
        });

        const initialFormValues = {
          filters: formFilters,
          changed: false,
        };

        form.setFieldsValue(initialFormValues);
      } else {
        const fallbackDatasetId = mostUsedDataset(loadedDatasets, charts);
        const newItem = createDefaultChartCustomizationItem(
          chartId,
          fallbackDatasetId,
        );
        setCurrentId(newItem.id);
        setItems([newItem]);

        const datasetInfo = fallbackDatasetId
          ? Object.values(loadedDatasets).find(
              dataset => dataset.id === Number(fallbackDatasetId),
            )
          : null;

        const initialFormValues = {
          filters: {
            [newItem.id]: {
              name: '',
              description: '',
              dataset: datasetInfo
                ? {
                    value: fallbackDatasetId,
                    label: DatasetSelectLabel({
                      id: Number(fallbackDatasetId),
                      table_name: datasetInfo.table_name || '',
                      schema: datasetInfo.schema || '',
                      database: {
                        database_name:
                          (datasetInfo.database?.database_name as string) ||
                          (datasetInfo.database?.name as string) ||
                          '',
                      },
                    }),
                    table_name: datasetInfo.table_name,
                    schema: datasetInfo.schema,
                  }
                : fallbackDatasetId
                  ? String(fallbackDatasetId)
                  : null,
              column: null,
              sortFilter: false,
              sortAscending: true,
              sortMetric: null,
              hasDefaultValue: false,
              isRequired: false,
              selectFirst: false,
            },
          },
          changed: false,
        };

        form.setFieldsValue(initialFormValues);
      }
      setInitialLoadComplete(true);
    }
  }, [
    isOpen,
    initialLoadComplete,
    existingItems,
    initialItemId,
    form,
    chartId,
    loadedDatasets,
    charts,
  ]);
  useEffect(() => {
    if (!isOpen) {
      setInitialLoadComplete(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isEmpty(items)) {
      setErroredItems(prevErroredItems =>
        prevErroredItems.filter(
          f => !items.find(item => item.id === f)?.removed,
        ),
      );
    }
  }, [items]);

  const leftPane = (
    <div
      css={{
        minWidth: '290px',
        maxWidth: '290px',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        borderRight: `1px solid ${theme.colorSplit}`,
      }}
    >
      <ChartCustomizationTitlePane
        items={items.filter(
          item => !removedItems[item.id] || removedItems[item.id]?.isPending,
        )}
        currentId={currentId}
        chartId={chartId}
        setCurrentId={setCurrentId}
        onChange={setCurrentId}
        onAdd={addItem}
        onRemove={handleRemoveItem}
        restoreItem={restoreItem}
        removedItems={removedItems}
        erroredItems={erroredItems}
      />
    </div>
  );

  const rightPane = (
    <div
      css={{
        flex: 1,
        overflow: 'auto',
        padding: `${theme.sizeUnit * 4}px`,
      }}
    >
      {items
        .filter(
          item => !removedItems[item.id] || removedItems[item.id]?.isPending,
        )
        .map(item => {
          const isRemoved = !!removedItems[item.id];
          return (
            <div
              key={item.id}
              css={{
                display: item.id === currentId ? 'block' : 'none',
              }}
            >
              {isRemoved ? (
                <RemovedFilter onClick={() => restoreItem(item.id)} />
              ) : (
                <ChartCustomizationForm
                  form={form}
                  item={item}
                  onUpdate={updatedItem => {
                    setItems(prev =>
                      prev.map(i =>
                        i.id === updatedItem.id ? updatedItem : i,
                      ),
                    );

                    form.setFieldsValue({
                      changed: true,
                    });

                    handleErroredItems();
                  }}
                />
              )}
            </div>
          );
        })}
    </div>
  );

  const content = (
    <div
      css={{
        display: 'flex',
        height: '100%',
      }}
    >
      {leftPane}
      {rightPane}
    </div>
  );

  return (
    <BaseConfigModal
      isOpen={isOpen}
      title={t('Chart customization')}
      expanded={expanded}
      onCancel={handleCancel}
      onSave={handleSave}
      leftPane={content}
      rightPane={null}
      form={form}
      onValuesChange={handleValuesChange}
      onToggleExpand={handleToggleExpand}
      canSave={!erroredItems.length}
      saveAlertVisible={saveAlertVisible}
      onDismissSaveAlert={() => setSaveAlertVisible(false)}
      onConfirmCancel={handleConfirmCancel}
      testId="chart-customization-modal"
    />
  );
};
export default memo(ChartCustomizationModal);
