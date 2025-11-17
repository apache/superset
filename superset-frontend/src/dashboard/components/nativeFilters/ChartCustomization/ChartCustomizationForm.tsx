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
import {
  FC,
  useEffect,
  useMemo,
  useState,
  useRef,
  useCallback,
  ReactNode,
} from 'react';
import { useSelector } from 'react-redux';
import { t } from '@superset-ui/core';
import { styled, css, useTheme } from '@apache-superset/core/ui';
import { debounce } from 'lodash';
import { DatasourcesState, ChartsState, RootState } from 'src/dashboard/types';
import {
  Constants,
  FormItem,
  Input,
  Select,
  Collapse,
  InfoTooltip,
  Loading,
  Radio,
  type SelectValue,
  FormInstance,
  Checkbox,
  CheckboxChangeEvent,
} from '@superset-ui/core/components';
import { DatasetSelectLabel } from 'src/features/datasets/DatasetSelectLabel';
import { CollapsibleControl } from '../FiltersConfigModal/FiltersConfigForm/CollapsibleControl';
import DatasetSelect from '../FiltersConfigModal/FiltersConfigForm/DatasetSelect';
import { mostUsedDataset } from '../FiltersConfigModal/FiltersConfigForm/utils';
import { ChartCustomizationItem } from './types';
import { selectChartCustomizationItems } from './selectors';

const { TextArea } = Input;

interface Metric {
  metric_name: string;
  verbose_name?: string;
}

interface DatasetDetails {
  id: number;
  table_name: string;
  schema?: string;
  database?: { database_name: string };
}

interface ApiError {
  message?: string;
  error?: string;
}

interface DatasetColumn {
  column_name?: string;
  name?: string;
  verbose_name?: string;
  filterable?: boolean;
}

interface DatasetData {
  id: number;
  table_name: string;
  schema?: string;
  database?: { database_name: string };
  metrics?: Metric[];
  columns?: DatasetColumn[];
}

interface CachedDataset {
  data: DatasetData;
  timestamp: number;
}

interface ColumnOption {
  label: string;
  value: string;
}

interface Props {
  form: FormInstance<Record<string, unknown>>;
  item: ChartCustomizationItem;
  onUpdate: (updatedItem: ChartCustomizationItem) => void;
  removedItems: Record<string, { isPending: boolean; timerId?: number } | null>;
  allItems?: ChartCustomizationItem[];
}

const datasetCache = new Map<number, CachedDataset>();

const CACHE_TTL = 5 * 60 * 1000;

function getCachedDataset(datasetId: number): DatasetData | null {
  const cached = datasetCache.get(datasetId);
  if (!cached) return null;

  if (Date.now() - cached.timestamp > CACHE_TTL) {
    datasetCache.delete(datasetId);
    return null;
  }

  return cached.data;
}

function setCachedDataset(datasetId: number, data: DatasetData): void {
  datasetCache.set(datasetId, {
    data,
    timestamp: Date.now(),
  });
}

const StyledContainer = styled.div`
  ${({ theme }) => `
   display: flex;
   flex-direction: row;
   gap: ${theme.sizeUnit * 4}px;
   padding: ${theme.sizeUnit * 2}px;
 `}
`;

const FORM_ITEM_WIDTH = 300;

const StyledFormItem = styled(FormItem)`
  ${({ theme }) => `
    width: ${FORM_ITEM_WIDTH}px;
    margin-bottom: ${theme.sizeUnit * 4}px;
  `}
`;

const CheckboxLabel = styled.span`
  ${({ theme }) => `
    font-size: ${theme.fontSizeSM}px;
    color: ${theme.colorTextSecondary};
  `}
`;

const StyledRadioGroup = styled(Radio.Group)`
  .ant-radio-wrapper {
    font-size: ${({ theme }) => theme.fontSizeSM}px;
  }
`;

const StyledMarginTop = styled.div`
  margin-top: ${({ theme }) => theme.sizeUnit * 2}px;
`;

const ChartCustomizationForm: FC<Props> = ({
  form,
  item,
  onUpdate,
  removedItems,
  allItems,
}) => {
  const theme = useTheme();
  const customization = useMemo(
    () => item.customization || {},
    [item.customization],
  );

  const isRemoved = !!removedItems[item.id];

  const loadedDatasets = useSelector<RootState, DatasourcesState>(
    ({ datasources }) => datasources,
  );
  const charts = useSelector<RootState, ChartsState>(({ charts }) => charts);
  const globalChartCustomizationItems = useSelector(
    selectChartCustomizationItems,
  );

  const chartCustomizationItems = allItems || globalChartCustomizationItems;

  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [isDefaultValueLoading, setIsDefaultValueLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [datasetDetails, setDatasetDetails] = useState<DatasetDetails | null>(
    null,
  );
  const [hasDefaultValue, setHasDefaultValue] = useState(
    customization.hasDefaultValue ?? false,
  );
  const [isRequired, setIsRequired] = useState(
    customization.isRequired ?? false,
  );
  const [selectFirst, setSelectFirst] = useState(
    customization.selectFirst ?? false,
  );

  const [canSelectMultiple, setCanSelectMultiple] = useState(
    customization.canSelectMultiple ?? true,
  );

  const fetchedRef = useRef({
    dataset: null,
    column: null,
    hasDefaultValue: false,
    defaultValueDataFetched: false,
  });

  const getDatasetId = useCallback(
    (
      dataset:
        | string
        | number
        | { value: string | number }
        | { id: string | number }
        | null,
    ): number | null => {
      if (!dataset) return null;

      if (typeof dataset === 'number') return dataset;
      if (typeof dataset === 'string') {
        const id = Number(dataset);
        return Number.isNaN(id) ? null : id;
      }
      if (
        typeof dataset === 'object' &&
        dataset !== null &&
        'value' in dataset
      ) {
        const id = Number(dataset.value);
        return Number.isNaN(id) ? null : id;
      }
      if (typeof dataset === 'object' && dataset !== null && 'id' in dataset) {
        const id = Number(dataset.id);
        return Number.isNaN(id) ? null : id;
      }

      return null;
    },
    [],
  );

  const getFormValues = useCallback(
    () => form.getFieldValue('filters')?.[item.id] || {},
    [form, item.id],
  );

  const excludeDatasetIds = useMemo(() => {
    const usedIds: number[] = [];

    chartCustomizationItems.forEach(customItem => {
      if (customItem.id === item.id || customItem.removed) {
        return;
      }

      const { dataset } = customItem.customization;
      const datasetId = getDatasetId(dataset);
      if (datasetId !== null) {
        usedIds.push(datasetId);
      }
    });

    return usedIds;
  }, [chartCustomizationItems, item.id, getDatasetId]);

  const datasetValue = useMemo(() => {
    const datasetId = getDatasetId(customization.dataset);

    if (!datasetId) {
      return null;
    }

    const loadedDataset = Object.values(loadedDatasets).find(
      dataset => dataset.id === Number(datasetId),
    );

    if (loadedDataset) {
      return {
        value: datasetId,
        label: DatasetSelectLabel({
          id: Number(datasetId),
          table_name: loadedDataset.table_name || '',
          schema: loadedDataset.schema || '',
          database: {
            database_name:
              (loadedDataset.database?.database_name as string) ||
              (loadedDataset.database?.name as string) ||
              '',
          },
        }),
        table_name: loadedDataset.table_name,
        schema: loadedDataset.schema,
      };
    }

    if (datasetDetails && datasetDetails.id === datasetId) {
      return {
        value: datasetId,
        label: DatasetSelectLabel({
          id: Number(datasetId),
          table_name: datasetDetails.table_name || '',
          schema: datasetDetails.schema || '',
          database: {
            database_name:
              (datasetDetails.database?.database_name as string) || '',
          },
        }),
        table_name: datasetDetails.table_name,
        schema: datasetDetails.schema,
      };
    }

    if (customization.datasetInfo) {
      const datasetInfo = customization.datasetInfo as {
        value: number;
        label: string;
        table_name: string;
        schema?: string;
      };
      return {
        value: datasetId,
        label: datasetInfo.label,
        table_name: datasetInfo.table_name,
        schema: datasetInfo.schema,
      };
    }

    return {
      value: datasetId,
      label: `Dataset ${datasetId}`,
    };
  }, [
    customization.dataset,
    customization.datasetInfo,
    datasetDetails,
    loadedDatasets,
    getDatasetId,
  ]);

  const formChanged = useCallback(() => {
    form.setFields([{ name: 'changed', value: true }]);

    const formValues = form.getFieldValue('filters')?.[item.id] || {};
    onUpdate({
      ...item,
      customization: {
        ...customization,
        ...formValues,
      },
    });
  }, [form, item, customization, onUpdate]);

  const debouncedFormChanged = useMemo(
    () => debounce(formChanged, Constants.SLOW_DEBOUNCE),
    [formChanged],
  );

  const setFormFieldValues = useCallback(
    (values: object) => {
      const currentFilters = form.getFieldValue('filters') || {};
      form.setFieldsValue({
        filters: {
          ...currentFilters,
          [item.id]: {
            ...currentFilters[item.id],
            ...values,
          },
        },
      });
    },
    [form, item.id],
  );

  const setChartCustomizationFieldValues = useCallback(
    (itemId: string, values: Record<string, unknown>) => {
      const currentFilters = form.getFieldValue('filters') || {};
      const currentItem = currentFilters[itemId] || {};

      form.setFieldsValue({
        filters: {
          ...currentFilters,
          [itemId]: {
            ...currentItem,
            ...values,
          },
        },
      });
    },
    [form],
  );

  const ensureFilterSlot = useCallback(() => {
    const currentFilters = form.getFieldValue('filters') || {};
    if (!currentFilters[item.id]) {
      form.setFieldsValue({
        filters: {
          ...currentFilters,
          [item.id]: {},
        },
      });
    }
  }, [form, item.id]);

  const fetchDatasetInfo = useCallback(async () => {
    const formValues = getFormValues();
    const dataset = formValues.dataset || customization.dataset;

    if (!dataset) {
      setMetrics([]);
      return;
    }

    try {
      const datasetId = getDatasetId(dataset);
      if (datasetId === null) return;

      const cachedData = getCachedDataset(datasetId);
      if (cachedData) {
        const datasetDetails = {
          id: cachedData.id,
          table_name: cachedData.table_name,
          schema: cachedData.schema,
          database: cachedData.database,
        };

        setDatasetDetails(datasetDetails);

        const currentFilters = form.getFieldValue('filters') || {};
        const currentItemValues = currentFilters[item.id] || {};

        if (
          currentItemValues.dataset &&
          typeof currentItemValues.dataset === 'string'
        ) {
          const enhancedDataset = {
            value: Number(currentItemValues.dataset),
            label: cachedData.table_name,
            table_name: cachedData.table_name,
            schema: cachedData.schema,
          };

          form.setFieldsValue({
            filters: {
              ...currentFilters,
              [item.id]: {
                ...currentItemValues,
                dataset: currentItemValues.dataset,
                datasetInfo: enhancedDataset,
                ...currentItemValues,
              },
            },
          });
        }

        if (cachedData.metrics && cachedData.metrics.length > 0) {
          setMetrics(cachedData.metrics);
        } else {
          setMetrics([]);
        }
        return;
      }

      const response = await fetch(`/api/v1/dataset/${datasetId}`);
      const data = await response.json();

      if (data?.result) {
        setCachedDataset(datasetId, {
          ...data.result,
          metrics: data.result.metrics || [],
          columns: data.result.columns || [],
        });

        const datasetDetails = {
          id: data.result.id,
          table_name: data.result.table_name,
          schema: data.result.schema,
          database: data.result.database,
        };

        setDatasetDetails(datasetDetails);

        const currentFilters = form.getFieldValue('filters') || {};
        const currentItemValues = currentFilters[item.id] || {};

        if (
          currentItemValues.dataset &&
          typeof currentItemValues.dataset === 'string'
        ) {
          const enhancedDataset = {
            value: Number(currentItemValues.dataset),
            label: data.result.table_name,
            table_name: data.result.table_name,
            schema: data.result.schema,
          };

          form.setFieldsValue({
            filters: {
              ...currentFilters,
              [item.id]: {
                ...currentItemValues,
                dataset: currentItemValues.dataset,
                datasetInfo: enhancedDataset,
                ...currentItemValues,
              },
            },
          });
        }

        if (data.result.metrics && data.result.metrics.length > 0) {
          setMetrics(data.result.metrics);
        } else {
          setMetrics([]);
        }
      }
    } catch (error) {
      console.error('Error fetching dataset info:', error);
      setMetrics([]);
    }
  }, [form, item.id, customization.dataset, getDatasetId]);

  useEffect(() => {
    const formValues = form.getFieldValue('filters')?.[item.id] || {};
    const dataset = formValues.dataset || customization.dataset;

    if (dataset) {
      const datasetId = getDatasetId(dataset);

      if (datasetId !== null) {
        fetchDatasetInfo();
      }
    }
  }, [customization.dataset, fetchDatasetInfo, getDatasetId]);

  const fetchDefaultValueData = useCallback(async () => {
    const formValues = getFormValues();
    const dataset = formValues.dataset || customization.dataset;

    if (!dataset) {
      return;
    }

    setIsDefaultValueLoading(true);
    try {
      const datasetId =
        typeof dataset === 'object' && dataset !== null
          ? dataset.value
          : getDatasetId(dataset);
      if (datasetId === null) {
        throw new Error('Invalid dataset ID');
      }

      let data;
      const cachedData = getCachedDataset(datasetId);
      if (cachedData) {
        data = { result: cachedData };
      } else {
        const response = await fetch(`/api/v1/dataset/${datasetId}`);
        data = await response.json();
        if (data?.result) {
          setCachedDataset(datasetId, {
            ...data.result,
            metrics: data.result.metrics || [],
            columns: data.result.columns || [],
          });
        }
      }

      if (!data?.result?.columns) {
        throw new Error('No columns found in dataset');
      }

      const columns = data.result.columns
        .filter((col: DatasetColumn) => col.filterable !== false)
        .map((col: DatasetColumn) => ({
          label: col.verbose_name || col.column_name || col.name,
          value: col.column_name || col.name,
        }));

      ensureFilterSlot();
      const currentFilters = form.getFieldValue('filters') || {};

      const currentFormValues = getFormValues();
      const selectFirstEnabled =
        currentFormValues.selectFirst ?? customization.selectFirst ?? false;

      let autoSelectedColumn = null;
      if (selectFirstEnabled && columns.length > 0) {
        autoSelectedColumn = columns[0].value;
      }

      form.setFieldsValue({
        filters: {
          ...currentFilters,
          [item.id]: {
            ...currentFilters[item.id],
            defaultValueQueriesData: columns,
            filterType: 'filter_select',
            hasDefaultValue: true,
            ...(autoSelectedColumn && { column: autoSelectedColumn }),
            chartConfiguration: {
              tooltip: {
                appendToBody: true,
                confine: true,
              },
            },
          },
        },
      });

      onUpdate({
        ...item,
        customization: {
          ...customization,
          defaultValueQueriesData: columns,
          hasDefaultValue:
            formValues.hasDefaultValue ?? customization.hasDefaultValue,
          ...(autoSelectedColumn && { column: autoSelectedColumn }),
        },
      });

      setError(null);
    } catch (error) {
      setError(error);

      ensureFilterSlot();
      const currentFilters = form.getFieldValue('filters') || {};

      form.setFieldsValue({
        filters: {
          ...currentFilters,
          [item.id]: {
            ...currentFilters[item.id],
            defaultValueQueriesData: null,
            hasDefaultValue:
              currentFilters[item.id]?.hasDefaultValue ??
              customization.hasDefaultValue ??
              false,
          },
        },
      });
    } finally {
      setIsDefaultValueLoading(false);
    }
  }, [customization, ensureFilterSlot, form, item, onUpdate, getDatasetId]);

  useEffect(() => {
    ensureFilterSlot();

    const defaultDataset = customization.dataset
      ? String(getDatasetId(customization.dataset) || customization.dataset)
      : null;

    const initialValues = {
      filters: {
        [item.id]: {
          name: customization.name || '',
          description: customization.description || '',
          dataset: defaultDataset,
          column: customization.column || null,
          filterType: 'filter_select',
          sortFilter: customization.sortFilter || false,
          sortAscending: customization.sortAscending !== false,
          sortMetric: customization.sortMetric || null,
          hasDefaultValue: customization.hasDefaultValue || false,
          isRequired: customization.isRequired || false,
          selectFirst: customization.selectFirst || false,
          defaultValue: customization.defaultValue,
          defaultDataMask: customization.defaultDataMask,
          defaultValueQueriesData: customization.defaultValueQueriesData,
        },
      },
    };

    form.setFieldsValue(initialValues);

    if (customization.dataset || defaultDataset) {
      fetchDatasetInfo();
    }

    if (customization.isRequired) {
      setTimeout(() => {
        form
          .validateFields([['filters', item.id, 'isRequired']])
          .catch(() => {});
      }, 0);
    }
  }, [
    item.id,
    fetchDatasetInfo,
    customization,
    form,
    ensureFilterSlot,
    loadedDatasets,
    charts,
    getDatasetId,
  ]);

  useEffect(() => {
    const formValues = form.getFieldValue('filters')?.[item.id] || {};
    const hasDataset = !!formValues.dataset;
    const hasColumn = !!formValues.column;
    const hasDefaultValue = !!formValues.hasDefaultValue;
    const isRequired = !!formValues.controlValues?.enableEmptyFilter;

    if (hasDataset && fetchedRef.current.dataset !== formValues.dataset) {
      fetchDatasetInfo();
    }

    if (isRequired && (!hasDataset || !hasColumn)) {
      setTimeout(() => {
        form
          .validateFields([
            ['filters', item.id, 'controlValues', 'enableEmptyFilter'],
          ])
          .catch(() => {});
      }, 0);
    }

    if (
      hasDataset &&
      hasColumn &&
      hasDefaultValue &&
      (fetchedRef.current.dataset !== formValues.dataset ||
        fetchedRef.current.column !== formValues.column ||
        !fetchedRef.current.defaultValueDataFetched)
    ) {
      fetchedRef.current = {
        dataset: formValues.dataset,
        column: formValues.column,
        hasDefaultValue,
        defaultValueDataFetched: true,
      };

      fetchDefaultValueData();
    }
  }, [form, item.id, fetchDatasetInfo, fetchDefaultValueData]);

  useEffect(() => {
    const formValues = form.getFieldValue('filters')?.[item.id] || {};
    const selectFirst = formValues.selectFirst ?? customization.selectFirst;

    if (selectFirst) {
      setHasDefaultValue(false);
    } else {
      setHasDefaultValue(
        formValues.hasDefaultValue ?? customization.hasDefaultValue ?? false,
      );
      if (formValues.isRequired !== undefined) {
        setIsRequired(formValues.isRequired);
      }
    }

    setSelectFirst(selectFirst);
  }, [form, item.id, customization.selectFirst, customization.hasDefaultValue]);

  const isRequiredValidator = useCallback(
    async (_, enableEmptyFilter) => {
      if (!enableEmptyFilter) {
        return Promise.resolve();
      }

      const current = form.getFieldValue(['filters', item.id]) || {};
      if (!current.dataset) {
        return Promise.reject(
          new Error(
            t(
              'Dataset must be selected when "Dynamic group by value is required" is enabled',
            ),
          ),
        );
      }

      return Promise.resolve();
    },
    [form, item.id],
  );

  const getDefaultValueTooltip = useCallback(() => {
    if (selectFirst) {
      return t(
        'Default value set automatically when "Select first filter value by default" is checked',
      );
    }
    if (isRequired) {
      return t(
        'Default value must be set when "Dynamic group by value is required" is checked',
      );
    }
    if (hasDefaultValue) {
      return t(
        'Default value must be set when "Dynamic group by has a default value" is checked',
      );
    }
    return t('Set a default value for this filter');
  }, [selectFirst, isRequired, hasDefaultValue]);

  const hasAllRequiredFields = useCallback(() => {
    const formValues = form.getFieldValue('filters')?.[item.id] || {};
    const { name = '', dataset } = formValues;
    const nameValue = name || customization.name || '';

    const hasExplicitDataset =
      dataset && typeof dataset === 'string' && dataset.trim() !== '';

    return !!(nameValue.trim() && hasExplicitDataset);
  }, [form, item.id, customization.name]);

  const shouldShowDefaultValue = useCallback(() => {
    const allFieldsFilled = hasAllRequiredFields();
    const isRequiredFromForm = !!form.getFieldValue([
      'filters',
      item.id,
      'controlValues',
      'enableEmptyFilter',
    ]);

    if (isRequiredFromForm) {
      return allFieldsFilled && !isDefaultValueLoading;
    }

    return hasDefaultValue && allFieldsFilled && !isDefaultValueLoading;
  }, [
    hasAllRequiredFields,
    form,
    item.id,
    customization.dataset,
    hasDefaultValue,
    isDefaultValueLoading,
  ]);

  const handleIsRequiredChange = useCallback(
    ({ target: { checked } }: CheckboxChangeEvent) => {
      const currentFilters = form.getFieldValue('filters') || {};
      const currentItem = currentFilters[item.id] || {};
      const currentControlValues = currentItem.controlValues || {};

      if (checked) {
        const updatedValues = {
          controlValues: {
            ...currentControlValues,
            enableEmptyFilter: checked,
          },
          hasDefaultValue: true,
        };
        setChartCustomizationFieldValues(item.id, updatedValues);
        setHasDefaultValue(true);
        fetchDefaultValueData();
      } else {
        const updatedValues = {
          controlValues: {
            ...currentControlValues,
            enableEmptyFilter: checked,
          },
        };
        setChartCustomizationFieldValues(item.id, updatedValues);
      }

      formChanged();
    },
    [
      form,
      item.id,
      setChartCustomizationFieldValues,
      formChanged,
      fetchDefaultValueData,
    ],
  );

  return (
    <div>
      <StyledContainer>
        <StyledFormItem
          name={['filters', item.id, 'name']}
          label={t('Dynamic group by name')}
          initialValue={customization.name || ''}
          rules={[{ required: !isRemoved, message: t('Please enter a name') }]}
        >
          <Input
            placeholder={t('Name your dynamic group by')}
            onChange={debouncedFormChanged}
          />
        </StyledFormItem>

        <StyledFormItem
          name={['filters', item.id, 'dataset']}
          label={
            <>
              {t('Dataset')}&nbsp;
              <InfoTooltip
                tooltip={t('Select the dataset this group by will use')}
                placement="right"
              />
            </>
          }
          initialValue={datasetValue}
          rules={[
            { required: !isRemoved, message: t('Please select a dataset') },
          ]}
        >
          <DatasetSelect
            excludeDatasetIds={excludeDatasetIds}
            value={
              mostUsedDataset(loadedDatasets, charts)
                ? {
                    value: mostUsedDataset(loadedDatasets, charts),
                    label: `Dataset ${mostUsedDataset(loadedDatasets, charts)}`,
                  }
                : undefined
            }
            onChange={(dataset: {
              label: string | ReactNode;
              value: number;
            }) => {
              const datasetId = dataset.value;

              const fetchDatasetAndUpdate = async () => {
                try {
                  const cachedData = getCachedDataset(datasetId);
                  let data;

                  if (cachedData) {
                    data = { result: cachedData };
                  } else {
                    const response = await fetch(
                      `/api/v1/dataset/${datasetId}`,
                    );
                    data = await response.json();

                    if (data?.result) {
                      setCachedDataset(datasetId, {
                        ...data.result,
                        metrics: data.result.metrics || [],
                        columns: data.result.columns || [],
                      });
                    }
                  }

                  if (data?.result) {
                    const datasetWithInfo = {
                      value: datasetId,
                      label: DatasetSelectLabel({
                        id: datasetId,
                        table_name: data.result.table_name || '',
                        schema: data.result.schema || '',
                        database: {
                          database_name:
                            (data.result.database?.database_name as string) ||
                            '',
                        },
                      }),
                      table_name: data.result.table_name,
                      schema: data.result.schema,
                    };

                    setFormFieldValues({
                      dataset: datasetWithInfo,
                      datasetInfo: datasetWithInfo,
                      column: null,
                      defaultValueQueriesData: null,
                      defaultValue: undefined,
                      defaultDataMask: undefined,
                    });

                    fetchDatasetInfo();
                    formChanged();
                  }
                } catch (error) {
                  console.error('Error fetching dataset info:', error);

                  const datasetWithInfo = {
                    value: datasetId,
                    label: `Dataset ${datasetId}`,
                    table_name: `Dataset ${datasetId}`,
                  };

                  setFormFieldValues({
                    dataset: datasetWithInfo,
                    datasetInfo: datasetWithInfo,
                    column: null,
                    defaultValueQueriesData: null,
                    defaultValue: undefined,
                    defaultDataMask: undefined,
                  });

                  form.setFields([
                    {
                      name: ['filters', item.id, 'dataset'],
                      value: datasetWithInfo,
                    },
                    {
                      name: ['filters', item.id, 'datasetInfo'],
                      value: datasetWithInfo,
                    },
                  ]);

                  fetchDatasetInfo();
                  formChanged();
                }
              };

              fetchDatasetAndUpdate();
            }}
          />
        </StyledFormItem>
      </StyledContainer>

      <Collapse
        defaultActiveKey={['settings']}
        expandIconPosition="right"
        modalMode
      >
        <Collapse.Panel header={t('Customization settings')} key="settings">
          <StyledFormItem
            name={['filters', item.id, 'description']}
            label={t('Description')}
            initialValue={customization.description || ''}
            css={css`
              width: 100% !important;
            `}
          >
            <TextArea
              placeholder={t(
                'Add description that will be displayed when hovering over the label...',
              )}
              onChange={debouncedFormChanged}
              autoSize={{ minRows: 2, maxRows: 3 }}
              css={css`
                resize: none;
              `}
            />
          </StyledFormItem>

          <StyledFormItem name={['filters', item.id, 'sortFilter']}>
            <CollapsibleControl
              checked={
                form.getFieldValue('filters')?.[item.id]?.sortFilter ??
                customization.sortFilter ??
                false
              }
              initialValue={customization.sortFilter ?? false}
              title={t('Sort filter values')}
              onChange={checked => {
                setFormFieldValues({
                  sortFilter: checked,
                  ...(checked === false
                    ? {
                        sortAscending: undefined,
                        sortMetric: undefined,
                      }
                    : {}),
                });
                formChanged();
              }}
            >
              <StyledFormItem
                name={['filters', item.id, 'sortAscending']}
                label={<CheckboxLabel>{t('Sort type')}</CheckboxLabel>}
                initialValue={customization.sortAscending !== false}
              >
                <StyledRadioGroup
                  options={[
                    { label: t('Sort ascending'), value: true },
                    { label: t('Sort descending'), value: false },
                  ]}
                  onChange={value => {
                    setFormFieldValues({
                      sortAscending: value.target.value,
                    });
                    formChanged();
                  }}
                />
              </StyledFormItem>

              {customization.sortFilter && metrics.length > 0 && (
                <StyledFormItem
                  name={['filters', item.id, 'sortMetric']}
                  label={
                    <>
                      <CheckboxLabel>{t('Sort Metric')}</CheckboxLabel>&nbsp;
                      <InfoTooltip
                        placement="top"
                        tooltip={t(
                          'If a metric is specified, sorting will be done based on the metric value',
                        )}
                      />
                    </>
                  }
                  initialValue={customization.sortMetric}
                >
                  <Select
                    allowClear
                    ariaLabel={t('Sort metric')}
                    value={
                      form.getFieldValue('filters')?.[item.id]?.sortMetric ??
                      customization.sortMetric
                    }
                    options={metrics.map((metric: Metric) => ({
                      value: metric.metric_name,
                      label: metric.verbose_name ?? metric.metric_name,
                    }))}
                    onChange={(value: SelectValue) => {
                      const stringValue =
                        value !== null && value !== undefined
                          ? String(value)
                          : undefined;

                      setFormFieldValues({
                        sortMetric: stringValue,
                      });
                      formChanged();
                    }}
                  />
                </StyledFormItem>
              )}
            </CollapsibleControl>
          </StyledFormItem>

          <StyledFormItem
            name={['filters', item.id, 'defaultValueQueriesData']}
            hidden
            initialValue={customization.defaultValueQueriesData || null}
          >
            <Input />
          </StyledFormItem>

          <StyledFormItem name={['filters', item.id, 'hasDefaultValue']}>
            <CollapsibleControl
              checked={hasDefaultValue}
              initialValue={customization.hasDefaultValue ?? false}
              disabled={
                !!form.getFieldValue([
                  'filters',
                  item.id,
                  'controlValues',
                  'enableEmptyFilter',
                ]) || selectFirst
              }
              title={t('Dynamic group by has a default value')}
              tooltip={getDefaultValueTooltip()}
              onChange={checked => {
                setHasDefaultValue(checked);
                if (checked) {
                  setSelectFirst(false);
                }
                setFormFieldValues({
                  hasDefaultValue: checked,
                  ...(checked ? { selectFirst: false } : {}),
                  ...(checked === false
                    ? {
                        defaultDataMask: null,
                        defaultValue: undefined,
                        defaultValueQueriesData: null,
                        column: null,
                      }
                    : {}),
                });

                if (checked) {
                  fetchDefaultValueData();
                  setTimeout(() => {
                    form.validateFields([
                      ['filters', item.id, 'defaultDataMask'],
                    ]);
                  }, 0);
                } else {
                  // Clear validation errors when unchecking
                  form.setFields([
                    {
                      name: ['filters', item.id, 'defaultDataMask'],
                      errors: [],
                    },
                  ]);
                }
                formChanged();
              }}
            >
              <StyledFormItem
                name={['filters', item.id, 'defaultDataMask']}
                initialValue={customization.defaultDataMask || null}
                label={<CheckboxLabel>{t('Default Value')}</CheckboxLabel>}
                required={hasDefaultValue}
                rules={[
                  {
                    validator: async () => {
                      const current =
                        form.getFieldValue(['filters', item.id]) || {};
                      if (!current.hasDefaultValue && !current.isRequired) {
                        return Promise.resolve();
                      }

                      const allFieldsFilled = hasAllRequiredFields();
                      if (!allFieldsFilled) {
                        return Promise.resolve();
                      }

                      const { column, defaultDataMask } = current;
                      const hasValidColumn =
                        column &&
                        (typeof column === 'string'
                          ? column.trim() !== ''
                          : Array.isArray(column)
                            ? column.length > 0
                            : false);

                      if (!hasValidColumn) {
                        return Promise.reject(
                          new Error(t('Please select a column')),
                        );
                      }

                      if (current.isRequired) {
                        const hasDefaultValue =
                          defaultDataMask?.filterState?.value &&
                          (Array.isArray(defaultDataMask.filterState.value)
                            ? defaultDataMask.filterState.value.length > 0
                            : defaultDataMask.filterState.value !== null &&
                              defaultDataMask.filterState.value !== undefined);

                        if (!hasDefaultValue) {
                          return Promise.reject(
                            new Error(
                              t(
                                'Default value is required when "Dynamic group by value is required" is enabled',
                              ),
                            ),
                          );
                        }
                      }

                      return Promise.resolve();
                    },
                  },
                ]}
              >
                {(() => {
                  const showDefaultValue = shouldShowDefaultValue();

                  if (error || showDefaultValue) {
                    return (
                      <StyledMarginTop>
                        {error ? (
                          <div style={{ color: theme.colorErrorText }}>
                            {t('Cannot load filter: ')}{' '}
                            {error.message || error.error || 'Unknown error'}
                          </div>
                        ) : (
                          <div>
                            <StyledFormItem
                              name={['filters', item.id, 'column']}
                              label={t('Select Column')}
                              initialValue={customization.column || null}
                            >
                              <Select
                                allowClear
                                placeholder={t('Select column')}
                                value={customization.column || null}
                                onChange={(value: string) => {
                                  if (value) {
                                    setFormFieldValues({
                                      column: value,
                                      defaultDataMask: {
                                        extraFormData: {},
                                        filterState: {
                                          value: [value],
                                        },
                                        ownState: {
                                          column: value,
                                        },
                                      },
                                      chartConfiguration: {
                                        tooltip: {
                                          appendToBody: true,
                                          confine: true,
                                        },
                                      },
                                    });

                                    form.validateFields([
                                      ['filters', item.id, 'column'],
                                      ['filters', item.id, 'defaultDataMask'],
                                    ]);
                                    formChanged();
                                  } else {
                                    setFormFieldValues({
                                      column: null,
                                      defaultDataMask: null,
                                    });

                                    form.validateFields([
                                      ['filters', item.id, 'column'],
                                      ['filters', item.id, 'defaultDataMask'],
                                    ]);
                                    formChanged();
                                  }
                                }}
                                options={(
                                  form.getFieldValue('filters')?.[item.id]
                                    ?.defaultValueQueriesData || []
                                ).map((option: ColumnOption) => ({
                                  ...option,
                                  label: option.label,
                                }))}
                                notFoundContent={t(
                                  'No compatible columns found',
                                )}
                              />
                            </StyledFormItem>
                          </div>
                        )}
                      </StyledMarginTop>
                    );
                  }

                  return (
                    <StyledMarginTop>
                      {isDefaultValueLoading ? (
                        <Loading position="inline-centered" />
                      ) : (
                        t('Fill all required fields to enable "Default Value"')
                      )}
                    </StyledMarginTop>
                  );
                })()}
              </StyledFormItem>
            </CollapsibleControl>
          </StyledFormItem>

          <StyledFormItem
            name={['filters', item.id, 'controlValues', 'enableEmptyFilter']}
            rules={[
              {
                validator: isRequiredValidator,
              },
            ]}
          >
            <Checkbox
              checked={
                !!form.getFieldValue([
                  'filters',
                  item.id,
                  'controlValues',
                  'enableEmptyFilter',
                ])
              }
              onChange={handleIsRequiredChange}
            >
              {t('Dynamic group by value is required')}&nbsp;
              <InfoTooltip
                tooltip={t(
                  'User must select a value before applying the filter',
                )}
                placement="right"
              />
            </Checkbox>
          </StyledFormItem>

          <StyledFormItem name={['filters', item.id, 'selectFirst']}>
            <CollapsibleControl
              checked={selectFirst}
              initialValue={customization.selectFirst ?? false}
              title={t('Select first filter value by default')}
              tooltip={t(
                "When using this option, default value can't be set. Using this option may impact the load times for your dashboard.",
              )}
              onChange={async checked => {
                setSelectFirst(checked);

                if (checked) {
                  setHasDefaultValue(false);
                  const formValues =
                    form.getFieldValue('filters')?.[item.id] || {};
                  const datasetColumns =
                    formValues.defaultValueQueriesData || [];

                  if (datasetColumns.length > 0) {
                    const firstColumn = datasetColumns[0];
                    setFormFieldValues({
                      selectFirst: checked,
                      hasDefaultValue: false,
                      defaultDataMask: null,
                      defaultValue: undefined,
                      defaultValueQueriesData: null,
                      column: firstColumn.value,
                    });
                  } else {
                    await fetchDefaultValueData();
                    setFormFieldValues({
                      selectFirst: checked,
                      hasDefaultValue: false,
                      defaultDataMask: null,
                      defaultValue: undefined,
                      defaultValueQueriesData: null,
                    });
                  }
                } else {
                  const isRequiredChecked = !!form.getFieldValue([
                    'filters',
                    item.id,
                    'controlValues',
                    'enableEmptyFilter',
                  ]);

                  if (isRequiredChecked) {
                    setHasDefaultValue(true);
                    setFormFieldValues({
                      selectFirst: checked,
                      hasDefaultValue: true,
                      column: null,
                    });
                  } else {
                    setFormFieldValues({
                      selectFirst: checked,
                      column: null,
                    });
                  }
                }
                formChanged();
              }}
            >
              <div />
            </CollapsibleControl>
          </StyledFormItem>

          <StyledFormItem name={['filters', item.id, 'canSelectMultiple']}>
            <CollapsibleControl
              checked={canSelectMultiple}
              initialValue={customization.canSelectMultiple ?? true}
              title={t('Can select multiple values')}
              tooltip={t(
                'Allow users to select multiple values for this filter',
              )}
              onChange={checked => {
                setCanSelectMultiple(checked);
                setFormFieldValues({
                  canSelectMultiple: checked,
                });
                formChanged();
              }}
            >
              <div />
            </CollapsibleControl>
          </StyledFormItem>
        </Collapse.Panel>
      </Collapse>
    </div>
  );
};

export default ChartCustomizationForm;
