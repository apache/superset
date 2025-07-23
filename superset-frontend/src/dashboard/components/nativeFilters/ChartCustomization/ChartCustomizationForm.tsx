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
import { t, styled, css, useTheme } from '@superset-ui/core';
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
} from '@superset-ui/core/components';
import {
  DatasetSelectLabel,
  type Dataset,
} from 'src/features/datasets/DatasetSelectLabel';
import { CollapsibleControl } from '../FiltersConfigModal/FiltersConfigForm/CollapsibleControl';
import DatasetSelect from '../FiltersConfigModal/FiltersConfigForm/DatasetSelect';
import { mostUsedDataset } from '../FiltersConfigModal/FiltersConfigForm/utils';
import { ChartCustomizationItem } from './types';

const { TextArea } = Input;

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
  width: ${FORM_ITEM_WIDTH}px;
  margin-bottom: ${({ theme }) => theme.sizeUnit * 4}px;

  .ant-form-item-label > label {
    font-size: ${({ theme }) => theme.fontSizeSM}px;
    font-weight: ${({ theme }) => theme.fontWeightNormal};
    color: ${({ theme }) => theme.colors.grayscale.dark1};
  }
`;

const CheckboxLabel = styled.span`
  ${({ theme }) => `
    font-size: ${theme.fontSizeSM}px;
    color: ${theme.colorTextSecondary};
  `}
`;

const StyledTextArea = styled(TextArea)`
  min-height: ${({ theme }) => theme.sizeUnit * 24}px;
  resize: vertical;
`;

const StyledRadioGroup = styled(Radio.Group)`
  .ant-radio-wrapper {
    font-size: ${({ theme }) => theme.fontSizeSM}px;
  }
`;

const StyledMarginTop = styled.div`
  margin-top: ${({ theme }) => theme.sizeUnit * 2}px;
`;

interface Props {
  form: any;
  item: ChartCustomizationItem;
  onUpdate: (updatedItem: ChartCustomizationItem) => void;
}

const ChartCustomizationForm: FC<Props> = ({ form, item, onUpdate }) => {
  const theme = useTheme();
  const customization = useMemo(
    () => item.customization || {},
    [item.customization],
  );

  const loadedDatasets = useSelector<RootState, DatasourcesState>(
    ({ datasources }) => datasources,
  );
  const charts = useSelector<RootState, ChartsState>(({ charts }) => charts);

  const [metrics, setMetrics] = useState<any[]>([]);
  const [isDefaultValueLoading, setIsDefaultValueLoading] = useState(false);
  const [error, setError] = useState<any>(null);
  const [datasetDetails, setDatasetDetails] = useState<{
    id: number;
    table_name: string;
    schema?: string;
    database?: { database_name: string };
  } | null>(null);
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

  const { chartId } = item;
  const chart = chartId ? charts[chartId] : null;
  const chartFormData = chart?.latestQueryFormData;

  const checkColumnConflict = useCallback(
    (columnName: string) => {
      if (!chartFormData) return false;

      const {
        viz_type: chartType,
        groupby = [],
        x_axis: xAxisColumn,
      } = chartFormData;

      if (groupby.includes(columnName) || xAxisColumn === columnName) {
        return true;
      }

      if (
        chartType?.startsWith('echarts_timeseries') ||
        chartType?.startsWith('echarts_area')
      ) {
        if (xAxisColumn === columnName) {
          return true;
        }
      } else if (chartType === 'heatmap_v2') {
        if (xAxisColumn === columnName) {
          return true;
        }
        const groupbyColumn = Array.isArray(chartFormData.groupby)
          ? chartFormData.groupby[0]
          : chartFormData.groupby;
        if (groupbyColumn === columnName) {
          return true;
        }
      } else if (chartType === 'pivot_table_v2') {
        const groupbyColumns = chartFormData.groupbyColumns || [];
        const groupbyRows = chartFormData.groupbyRows || [];
        if ([...groupbyColumns, ...groupbyRows].includes(columnName)) {
          return true;
        }
      }

      return false;
    },
    [chartFormData],
  );

  const getConflictMessage = useCallback(
    (columnName: string) => {
      if (!chartFormData) return '';

      const chartType = chartFormData.viz_type;
      const existingGroupBy = chartFormData.groupby || [];
      const xAxisColumn = chartFormData.x_axis;

      if (existingGroupBy.includes(columnName)) {
        return t("This column is already used in the chart's group by");
      }
      if (xAxisColumn === columnName) {
        if (
          chartType?.startsWith('echarts_timeseries') ||
          chartType?.startsWith('echarts_area')
        ) {
          return t(
            'This column is already used as the time axis in this timeseries chart',
          );
        }
        if (chartType === 'heatmap_v2') {
          return t(
            'This column is already used as the X-axis in this heatmap chart',
          );
        }
        return t('This column is already used as the X-axis in this chart');
      }

      if (chartType === 'heatmap_v2') {
        const groupbyColumn = Array.isArray(chartFormData.groupby)
          ? chartFormData.groupby[0]
          : chartFormData.groupby;
        if (groupbyColumn === columnName) {
          return t(
            'This column is already used as the Y-axis in this heatmap chart',
          );
        }
      }

      if (chartType === 'pivot_table_v2') {
        const groupbyColumns = chartFormData.groupbyColumns || [];
        const groupbyRows = chartFormData.groupbyRows || [];
        if (groupbyColumns.includes(columnName)) {
          return t('This column is already used in the pivot table columns');
        }
        if (groupbyRows.includes(columnName)) {
          return t('This column is already used in the pivot table rows');
        }
      }

      return t('This column conflicts with existing chart columns');
    },
    [chartFormData],
  );

  const datasetValue = useMemo(() => {
    const fallbackDatasetId = mostUsedDataset(loadedDatasets, charts);

    if (!customization.dataset) {
      if (fallbackDatasetId) {
        const datasetInfo = Object.values(loadedDatasets).find(
          dataset => dataset.id === fallbackDatasetId,
        );

        if (datasetInfo) {
          const label =
            datasetInfo.table_name +
            (datasetInfo.schema ? ` (${datasetInfo.schema})` : '') +
            (datasetInfo.database?.database_name
              ? ` [${datasetInfo.database.database_name}]`
              : '');

          return {
            value: fallbackDatasetId,
            label,
          };
        }

        return {
          value: fallbackDatasetId,
          label: `Dataset ${fallbackDatasetId}`,
        };
      }
      return undefined;
    }

    let datasetId: number;

    if (
      typeof customization.dataset === 'object' &&
      'value' in customization.dataset
    ) {
      datasetId = Number((customization.dataset as any).value);
    } else {
      datasetId = Number(customization.dataset);
    }

    if (Number.isNaN(datasetId)) return undefined;

    if (datasetDetails && datasetDetails.id === datasetId) {
      const label =
        datasetDetails.table_name +
        (datasetDetails.schema ? ` (${datasetDetails.schema})` : '') +
        (datasetDetails.database?.database_name
          ? ` [${datasetDetails.database.database_name}]`
          : '');

      return {
        value: datasetId,
        label,
      };
    }

    if (customization.datasetInfo) {
      if ('label' in customization.datasetInfo) {
        return {
          value: datasetId,
          label: (customization.datasetInfo as { label: string }).label,
        };
      }
      if ('table_name' in customization.datasetInfo) {
        const info = customization.datasetInfo as Dataset;
        return {
          value: datasetId,
          label: DatasetSelectLabel({
            id: datasetId,
            table_name: info.table_name,
            schema: info.schema,
            database: info.database,
          }),
        };
      }
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
    charts,
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
            ...(currentFilters[item.id] || {}),
            ...values,
          },
        },
      });
    },
    [form, item.id],
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
    const formValues = form.getFieldValue('filters')?.[item.id] || {};
    const dataset = formValues.dataset || customization.dataset;

    if (!dataset) {
      setMetrics([]);
      return;
    }

    try {
      let datasetId: number;
      if (
        typeof dataset === 'object' &&
        dataset !== null &&
        'value' in dataset
      ) {
        datasetId = Number((dataset as any).value);
      } else {
        datasetId = Number(dataset);
      }
      if (Number.isNaN(datasetId)) return;

      const response = await fetch(`/api/v1/dataset/${datasetId}`);
      const data = await response.json();

      if (data?.result) {
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
  }, [form, item.id, customization.dataset]);

  useEffect(() => {
    const formValues = form.getFieldValue('filters')?.[item.id] || {};
    const dataset = formValues.dataset || customization.dataset;

    if (dataset) {
      let datasetId: number;
      if (
        typeof dataset === 'object' &&
        dataset !== null &&
        'value' in dataset
      ) {
        datasetId = Number((dataset as any).value);
      } else {
        datasetId = Number(dataset);
      }

      if (!Number.isNaN(datasetId)) {
        fetchDatasetInfo();
      }
    }
  }, [customization.dataset, fetchDatasetInfo]);

  const fetchDefaultValueData = useCallback(async () => {
    const formValues = form.getFieldValue('filters')?.[item.id] || {};
    const dataset = formValues.dataset || customization.dataset;

    if (!dataset) {
      return;
    }

    setIsDefaultValueLoading(true);
    try {
      const datasetId = Number(dataset.value || dataset);
      if (Number.isNaN(datasetId)) {
        throw new Error('Invalid dataset ID');
      }

      const response = await fetch(`/api/v1/dataset/${datasetId}`);
      const data = await response.json();

      if (!data?.result?.columns) {
        throw new Error('No columns found in dataset');
      }

      const columns = data.result.columns
        .filter((col: any) => col.filterable !== false)
        .map((col: any) => ({
          label: col.verbose_name || col.column_name || col.name,
          value: col.column_name || col.name,
        }));

      ensureFilterSlot();
      const currentFilters = form.getFieldValue('filters') || {};

      const currentFormValues = form.getFieldValue('filters')?.[item.id] || {};
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
            ...(currentFilters[item.id] || {}),
            defaultValueQueriesData: columns,
            filterType: 'filter_select',
            hasDefaultValue: true,
            ...(autoSelectedColumn && { column: autoSelectedColumn }),
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
      console.error('Error fetching dataset columns:', error);
      setError(error);

      ensureFilterSlot();
      const currentFilters = form.getFieldValue('filters') || {};

      form.setFieldsValue({
        filters: {
          ...currentFilters,
          [item.id]: {
            ...(currentFilters[item.id] || {}),
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
  }, [customization, ensureFilterSlot, form, item, onUpdate]);

  useEffect(() => {
    ensureFilterSlot();

    const fallbackDatasetId = mostUsedDataset(loadedDatasets, charts);
    const defaultDataset = customization.dataset
      ? String(
          typeof customization.dataset === 'object' &&
            customization.dataset !== null
            ? (customization.dataset as any).value || customization.dataset
            : customization.dataset,
        )
      : fallbackDatasetId
        ? String(fallbackDatasetId)
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
  ]);

  useEffect(() => {
    const formValues = form.getFieldValue('filters')?.[item.id] || {};
    const hasDataset = !!formValues.dataset;
    const hasColumn = !!formValues.column;
    const hasDefaultValue = !!formValues.hasDefaultValue;
    const isRequired = !!formValues.isRequired;

    if (hasDataset && fetchedRef.current.dataset !== formValues.dataset) {
      fetchDatasetInfo();
    }

    if (isRequired && (!hasDataset || !hasColumn)) {
      setTimeout(() => {
        form
          .validateFields([['filters', item.id, 'isRequired']])
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
  }, [form, item.id, fetchDatasetInfo]);

  useEffect(() => {
    const formValues = form.getFieldValue('filters')?.[item.id] || {};
    const selectFirst = formValues.selectFirst ?? customization.selectFirst;

    if (selectFirst) {
      setHasDefaultValue(false);
      setIsRequired(false);
      setFormFieldValues({
        hasDefaultValue: false,
        isRequired: false,
        defaultDataMask: null,
        defaultValue: undefined,
        defaultValueQueriesData: null,
      });
    } else {
      setHasDefaultValue(
        formValues.hasDefaultValue ?? customization.hasDefaultValue ?? false,
      );
      if (formValues.isRequired !== undefined) {
        setIsRequired(formValues.isRequired);
      }
    }

    setSelectFirst(selectFirst);
  }, [
    form,
    item.id,
    setFormFieldValues,
    customization.selectFirst,
    customization.hasDefaultValue,
  ]);

  const isRequiredValidator = useCallback(
    async (_, isRequired) => {
      if (!isRequired) {
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
    const name = formValues.name || customization.name || '';
    const dataset = formValues.dataset || customization.dataset;
    return !!(name.trim() && dataset);
  }, [form, item.id, customization.name, customization.dataset]);

  const shouldShowDefaultValue = useCallback(() => {
    const allFieldsFilled = hasAllRequiredFields();
    const hasDataset = !!(
      form.getFieldValue('filters')?.[item.id]?.dataset || customization.dataset
    );

    if (isRequired) {
      return allFieldsFilled && !isDefaultValueLoading;
    }

    return hasDefaultValue && hasDataset && !isDefaultValueLoading;
  }, [
    hasAllRequiredFields,
    form,
    item.id,
    customization.dataset,
    isRequired,
    hasDefaultValue,
    isDefaultValueLoading,
  ]);

  return (
    <div>
      <StyledContainer>
        <StyledFormItem
          name={['filters', item.id, 'name']}
          label={t('Dynamic group by name')}
          initialValue={customization.name || ''}
          rules={[{ required: true, message: t('Please enter a name') }]}
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
          rules={[{ required: true, message: t('Please select a dataset') }]}
        >
          <DatasetSelect
            onChange={(dataset: {
              label: string | ReactNode;
              value: number;
            }) => {
              const label =
                typeof dataset.label === 'string' ? dataset.label : 'Dataset';

              const datasetWithInfo = {
                ...dataset,
                label,
                table_name: label,
              };

              const datasetId = dataset.value.toString();

              setFormFieldValues({
                dataset: datasetId,
                datasetInfo: datasetWithInfo,
                column: null,
                defaultValueQueriesData: null,
                defaultValue: undefined,
                defaultDataMask: undefined,
              });

              fetchDatasetInfo();
              formChanged();
            }}
          />
        </StyledFormItem>
      </StyledContainer>

      <Collapse defaultActiveKey={['settings']} expandIconPosition="right">
        <Collapse.Panel header={t('Customization settings')} key="settings">
          <StyledFormItem
            name={['filters', item.id, 'description']}
            label={t('Description')}
            initialValue={customization.description || ''}
            css={css`
              width: ${FORM_ITEM_WIDTH * 1.5}px;
            `}
          >
            <StyledTextArea
              placeholder={t(
                'Add description that will be displayed when hovering over the label...',
              )}
              onChange={debouncedFormChanged}
              autoSize={{ minRows: 4 }}
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
                    options={metrics.map((metric: any) => ({
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
              disabled={isRequired || selectFirst}
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

                      const { column } = current;
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
                          <div style={{ color: theme.colors.error.base }}>
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
                                    if (checkColumnConflict(value)) {
                                      return;
                                    }
                                    setFormFieldValues({
                                      column: value,
                                    });
                                    form.validateFields([
                                      ['filters', item.id, 'column'],
                                      ['filters', item.id, 'defaultDataMask'],
                                    ]);
                                    formChanged();
                                  } else {
                                    setFormFieldValues({
                                      column: null,
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
                                ).map((option: any) => ({
                                  ...option,
                                  disabled: checkColumnConflict(option.value),
                                  label: checkColumnConflict(option.value)
                                    ? `${option.label} (${getConflictMessage(option.value)})`
                                    : option.label,
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
            name={['filters', item.id, 'isRequired']}
            rules={[
              {
                validator: isRequiredValidator,
              },
            ]}
          >
            <CollapsibleControl
              checked={isRequired}
              initialValue={customization.isRequired ?? false}
              title={t('Dynamic group by value is required')}
              tooltip={t('User must select a value before applying the filter')}
              onChange={checked => {
                setIsRequired(checked);
                if (checked) {
                  setHasDefaultValue(true);
                  setSelectFirst(false);
                } else {
                  setHasDefaultValue(false);
                }
                setFormFieldValues({
                  isRequired: checked,
                  ...(checked
                    ? {
                        hasDefaultValue: true,
                        selectFirst: false,
                      }
                    : {
                        hasDefaultValue: false,
                        defaultDataMask: null,
                        defaultValue: undefined,
                        defaultValueQueriesData: null,
                      }),
                });

                if (checked && hasAllRequiredFields()) {
                  fetchDefaultValueData();
                }
                formChanged();
              }}
            >
              <div />
            </CollapsibleControl>
          </StyledFormItem>

          <StyledFormItem name={['filters', item.id, 'selectFirst']}>
            <CollapsibleControl
              checked={selectFirst}
              initialValue={customization.selectFirst ?? false}
              title={t('Select first filter value by default')}
              tooltip={t(
                "When using this option, default value can't be set. Using this option may impact the load times for your dashboard.",
              )}
              onChange={checked => {
                setSelectFirst(checked);
                if (checked) {
                  setHasDefaultValue(false);
                  setIsRequired(false);

                  const formValues =
                    form.getFieldValue('filters')?.[item.id] || {};
                  const datasetColumns =
                    formValues.defaultValueQueriesData || [];

                  if (datasetColumns.length > 0) {
                    const firstColumn = datasetColumns[0];
                    setFormFieldValues({
                      selectFirst: checked,
                      hasDefaultValue: false,
                      isRequired: false,
                      defaultDataMask: null,
                      defaultValue: undefined,
                      defaultValueQueriesData: null,
                      column: firstColumn.value,
                    });
                  } else {
                    setFormFieldValues({
                      selectFirst: checked,
                      hasDefaultValue: false,
                      isRequired: false,
                      defaultDataMask: null,
                      defaultValue: undefined,
                      defaultValueQueriesData: null,
                    });
                  }
                } else {
                  setFormFieldValues({
                    selectFirst: checked,
                  });
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
