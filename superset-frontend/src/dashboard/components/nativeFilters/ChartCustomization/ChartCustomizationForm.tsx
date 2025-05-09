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
import { FC, useEffect, useMemo, useState, useRef } from 'react';
import { t, styled, css } from '@superset-ui/core';
import { Form, FormItem } from 'src/components/Form';
import { TextArea } from 'src/components/Input';
import { Radio } from 'src/components/Radio';
import Select from 'src/components/Select/Select';
import Collapse from 'src/components/Collapse';
import { InfoTooltipWithTrigger } from '@superset-ui/chart-controls';
import Loading from 'src/components/Loading';
import { getChartDataRequest } from 'src/components/Chart/chartAction';
import { CollapsibleControl } from '../FiltersConfigModal/FiltersConfigForm/CollapsibleControl';
import DatasetSelect from '../FiltersConfigModal/FiltersConfigForm/DatasetSelect';
import DefaultValue from '../FiltersConfigModal/FiltersConfigForm/DefaultValue';
import { ChartCustomizationItem } from './types';
import { getFormData } from '../utils';

const StyledForm = styled(Form)`
  .ant-form-item {
    margin-bottom: ${({ theme }) => theme.gridUnit * 4}px;
  }
`;

const StyledContainer = styled.div`
  ${({ theme }) => `
    display: flex;
    flex-direction: row;
    gap: ${theme.gridUnit * 4}px;
    padding: ${theme.gridUnit * 2}px;
  `}
`;

const FORM_ITEM_WIDTH = 300;

const StyledFormItem = styled(FormItem)`
  width: ${FORM_ITEM_WIDTH}px;
  margin-bottom: ${({ theme }) => theme.gridUnit * 4}px;

  .ant-form-item-label > label {
    font-size: ${({ theme }) => theme.typography.sizes.m}px;
    font-weight: ${({ theme }) => theme.typography.weights.normal};
    color: ${({ theme }) => theme.colors.grayscale.dark1};
  }
`;

const CheckboxLabel = styled.span`
  font-size: ${({ theme }) => theme.typography.sizes.m}px;
  color: ${({ theme }) => theme.colors.grayscale.dark1};
  font-weight: ${({ theme }) => theme.typography.weights.normal};
`;

const StyledTextArea = styled(TextArea)`
  min-height: ${({ theme }) => theme.gridUnit * 24}px;
  resize: vertical;
`;

const StyledRadioGroup = styled(Radio.Group)`
  .ant-radio-wrapper {
    font-size: ${({ theme }) => theme.typography.sizes.m}px;
  }
`;

const StyledMarginTop = styled.div`
  margin-top: ${({ theme }) => theme.gridUnit * 2}px;
`;

interface Props {
  form: any;
  item: ChartCustomizationItem;
  onUpdate: (updatedItem: ChartCustomizationItem) => void;
}

const ChartCustomizationForm: FC<Props> = ({ form, item, onUpdate }) => {
  const { customization } = item;
  const [metrics, setMetrics] = useState<any[]>([]);
  const [hasMetrics, setHasMetrics] = useState(false);
  const [isDefaultValueLoading, setIsDefaultValueLoading] = useState(false);

  useEffect(() => {}, [customization]);

  const ensureFilterSlot = () => {
    const currentFilters = form.getFieldValue('filters') || {};
    if (!currentFilters[item.id]) {
      form.setFieldsValue({
        filters: {
          ...currentFilters,
          [item.id]: {},
        },
      });
    }
  };

  useEffect(() => {
    form.setFieldsValue({
      name: customization.name,
      dataset:
        customization.dataset &&
        typeof customization.dataset === 'object' &&
        'value' in customization.dataset
          ? (
              customization.dataset as { value: string | number | undefined }
            ).value?.toString()
          : customization.dataset?.toString(),
      description: customization.description,
      sortFilter: customization.sortFilter,
      sortAscending: customization.sortAscending,
      sortMetric: customization.sortMetric,
      hasDefaultValue: customization.hasDefaultValue,
      isRequired: customization.isRequired,
      selectFirst: customization.selectFirst,
    });
  }, [customization, form]);

  const handleValuesChange = (_: any, values: any) => {
    onUpdate({
      ...item,
      customization: {
        ...customization,
        ...values,
      },
    });
  };

  const generatedFormData = useMemo(() => {
    const datasetId = customization.dataset
      ? parseInt(customization.dataset, 10)
      : undefined;
    return getFormData({
      datasetId,
      groupby: customization.name,
      dashboardId: 0,
      filterType: 'filter_select',
      controlValues: {
        sortAscending: customization.sortAscending,
        sortMetric: customization.sortMetric,
      },
    });
  }, [
    customization.dataset,
    customization.name,
    customization.sortAscending,
    customization.sortMetric,
  ]);

  const datasetValue = useMemo(() => {
    if (!customization.dataset) return undefined;

    if (
      typeof customization.dataset === 'object' &&
      'label' in customization.dataset &&
      'value' in customization.dataset
    ) {
      return customization.dataset as unknown as {
        label: string;
        value: number;
      };
    }

    let datasetId: number;
    if (typeof customization.dataset === 'string') {
      datasetId = parseInt(customization.dataset, 10);
    } else if (typeof customization.dataset === 'number') {
      datasetId = customization.dataset;
    } else {
      return undefined;
    }

    return datasetId && !Number.isNaN(datasetId)
      ? { value: datasetId, label: `Dataset ${datasetId}` }
      : undefined;
  }, [customization.dataset]);

  const [columns, setColumns] = useState<any[]>([]);
  const [isLoadingColumns, setIsLoadingColumns] = useState(false);

  useEffect(() => {
    const fetchDatasetInfo = async () => {
      if (!customization.dataset) {
        setMetrics([]);
        setHasMetrics(false);
        setColumns([]);
        return;
      }

      setIsLoadingColumns(true);
      try {
        const datasetId = parseInt(customization.dataset.toString(), 10);
        if (Number.isNaN(datasetId)) return;

        const response = await fetch(`/api/v1/dataset/${datasetId}`);
        const data = await response.json();

        if (data?.result) {
          if (data.result.metrics) {
            setMetrics(data.result.metrics);
            setHasMetrics(data.result.metrics.length > 0);
          } else {
            setMetrics([]);
            setHasMetrics(false);
          }

          if (data.result.columns) {
            setColumns(data.result.columns);
          } else {
            setColumns([]);
          }
        }
      } catch (error) {
        setMetrics([]);
        setHasMetrics(false);
        setColumns([]);
      } finally {
        setIsLoadingColumns(false);
      }
    };

    fetchDatasetInfo();
  }, [customization.dataset]);

  const fetchedRef = useRef<{
    datasetId?: string;
    columnName?: string;
    hasDefaultValue?: boolean;
  }>({});

  useEffect(() => {
    const fetchDefaultValueData = async () => {
      if (
        !customization.dataset ||
        !customization.name ||
        !customization.hasDefaultValue
      ) {
        return;
      }

      // Check if we've already fetched for this exact combination
      const datasetId = customization.dataset.toString();
      if (
        fetchedRef.current.datasetId === datasetId &&
        fetchedRef.current.columnName === customization.name &&
        fetchedRef.current.hasDefaultValue === customization.hasDefaultValue
      ) {
        return;
      }

      fetchedRef.current = {
        datasetId,
        columnName: customization.name,
        hasDefaultValue: customization.hasDefaultValue,
      };

      setIsDefaultValueLoading(true);
      try {
        const datasetIdNum = parseInt(datasetId, 10);
        if (Number.isNaN(datasetIdNum)) {
          throw new Error('Invalid dataset ID');
        }

        const formData = getFormData({
          datasetId: datasetIdNum,
          dashboardId: 0,
          groupby: customization.name,
          filterType: 'filter_select',
          controlValues: {
            sortAscending: customization.sortAscending,
            sortMetric: customization.sortMetric,
          },
        });

        try {
          const { json } = await getChartDataRequest({
            formData,
          });

          const responseData = json;

          ensureFilterSlot();
          const currentFilters = form.getFieldValue('filters') || {};
          form.setFieldsValue({
            filters: {
              [item.id]: {
                ...currentFilters[item.id],
                defaultValueQueriesData: responseData.result,
                filterType: 'filter_select',
                column: customization.name,
              },
            },
          });

          const initialDataMask = {
            filterState: {
              value: null,
            },
            extraFormData: {},
          };

          onUpdate({
            ...item,
            customization: {
              ...customization,
              defaultDataMask: initialDataMask,
            },
          });
        } catch (error) {
          console.warn('Error fetching default value data:', error);
        }
      } catch (error) {
        console.warn('Error in fetchDefaultValueData:', error);
      } finally {
        setIsDefaultValueLoading(false);
      }
    };

    fetchDefaultValueData();
  }, [
    customization.dataset,
    customization.name,
    customization.hasDefaultValue,
    form,
    item,
    onUpdate,
  ]);

  const setDataMask = (dataMask: any) => {
    if (!dataMask.filterState) return;

    ensureFilterSlot();
    const filtersValue = form.getFieldValue('filters') || {};

    form.setFieldsValue({
      filters: {
        ...filtersValue,
        [item.id]: {
          ...(filtersValue[item.id] || {}),
          defaultDataMask: dataMask,
          defaultValue: dataMask.filterState?.value,
        },
      },
      defaultDataMask: dataMask,
    });

    form.validateFields(['defaultDataMask']).catch(() => {});

    onUpdate({
      ...item,
      customization: {
        ...customization,
        defaultDataMask: dataMask,
        defaultValue: dataMask.filterState?.value,
      },
    });
  };

  return (
    <StyledForm
      layout="vertical"
      form={form}
      onValuesChange={handleValuesChange}
    >
      <StyledContainer>
        <StyledFormItem
          name="name"
          label={
            <>
              {t('Dynamic group by field')}&nbsp;
              <InfoTooltipWithTrigger
                tooltip={t('Choose the column to group by')}
                placement="right"
              />
            </>
          }
          initialValue={customization.name}
          rules={[{ required: true, message: t('Please select a field') }]}
        >
          {isLoadingColumns ? (
            <Loading position="inline-centered" />
          ) : (
            <Select
              allowClear
              ariaLabel={t('Group by field')}
              placeholder={t('Select a field')}
              options={columns.map((column: any) => ({
                value: column.column_name,
                label: column.verbose_name || column.column_name,
              }))}
              onChange={(value: string) => {
                form.setFieldsValue({ name: value });
                onUpdate({
                  ...item,
                  customization: {
                    ...customization,
                    name: value,
                    column: value,
                  },
                });
              }}
            />
          )}
        </StyledFormItem>

        <StyledFormItem
          name="dataset"
          label={
            <>
              {t('Dataset')}&nbsp;
              <InfoTooltipWithTrigger
                tooltip={t('Select the dataset this group by will use')}
                placement="right"
              />
            </>
          }
          initialValue={
            datasetValue ? datasetValue.value.toString() : undefined
          }
          rules={[{ required: true, message: t('Please select a dataset') }]}
        >
          <DatasetSelect
            value={datasetValue}
            onChange={(dataset: { label: string; value: number }) => {
              const datasetId = dataset.value.toString();
              const currentName = form.getFieldValue('name');

              const datasetChanged = customization.dataset !== datasetId;

              form.setFieldsValue({ dataset: datasetId });

              if (datasetChanged) {
                fetchedRef.current = {};
                ensureFilterSlot();
                const currentFilters = form.getFieldValue('filters') || {};
                if (currentFilters[item.id]) {
                  form.setFieldsValue({
                    filters: {
                      [item.id]: {
                        ...currentFilters[item.id],
                        defaultValueQueriesData: null,
                      },
                    },
                  });
                }
              }

              onUpdate({
                ...item,
                customization: {
                  ...customization,
                  dataset: datasetId,
                  name: currentName || customization.name,
                  ...(datasetChanged && customization.hasDefaultValue
                    ? {
                        defaultDataMask: {
                          filterState: {
                            value: null,
                          },
                          extraFormData: {},
                        },
                        defaultValue: undefined,
                      }
                    : {}),
                },
              });
            }}
          />
        </StyledFormItem>
      </StyledContainer>

      <Collapse defaultActiveKey={['settings']} expandIconPosition="right">
        <Collapse.Panel header={t('Customization settings')} key="settings">
          <StyledFormItem
            name="description"
            label={t('Description')}
            css={css`
              width: ${FORM_ITEM_WIDTH * 1.5}px;
            `}
          >
            <StyledTextArea
              placeholder={t(
                'Add description that will be displayed when hovering over the label...',
              )}
              autoSize={{ minRows: 4 }}
              style={{ width: '100%' }}
            />
          </StyledFormItem>

          <StyledFormItem
            name="sortFilter"
            initialValue={customization.sortFilter}
          >
            <CollapsibleControl
              initialValue={customization.sortFilter}
              title={<CheckboxLabel>{t('Sort filter values')}</CheckboxLabel>}
              onChange={checked => {
                onUpdate({
                  ...item,
                  customization: {
                    ...customization,
                    sortFilter: checked,
                    sortAscending: checked
                      ? (customization.sortAscending ?? true)
                      : undefined,
                    sortMetric: checked ? customization.sortMetric : undefined,
                  },
                });
              }}
            >
              <StyledFormItem
                name="sortAscending"
                label={t('Sort type')}
                initialValue={customization.sortAscending}
              >
                <StyledRadioGroup
                  options={[
                    { label: t('Sort ascending'), value: true },
                    { label: t('Sort descending'), value: false },
                  ]}
                  onChange={e => {
                    const { value } = e.target;
                    form.setFieldsValue({ sortAscending: value });
                    onUpdate({
                      ...item,
                      customization: {
                        ...customization,
                        sortAscending: value,
                      },
                    });
                  }}
                />
              </StyledFormItem>

              {hasMetrics && (
                <StyledFormItem
                  name="sortMetric"
                  initialValue={customization.sortMetric}
                  label={
                    <>
                      <CheckboxLabel>{t('Sort Metric')}</CheckboxLabel>&nbsp;
                      <InfoTooltipWithTrigger
                        placement="top"
                        tooltip={t(
                          'If a metric is specified, sorting will be done based on the metric value',
                        )}
                      />
                    </>
                  }
                >
                  <Select
                    allowClear
                    ariaLabel={t('Sort metric')}
                    options={metrics.map((metric: any) => ({
                      value: metric.metric_name,
                      label: metric.verbose_name ?? metric.metric_name,
                    }))}
                    onChange={(value: string) => {
                      form.setFieldsValue({ sortMetric: value });
                      onUpdate({
                        ...item,
                        customization: {
                          ...customization,
                          sortMetric: value,
                        },
                      });
                    }}
                  />
                </StyledFormItem>
              )}
            </CollapsibleControl>
          </StyledFormItem>

          <StyledFormItem
            name="hasDefaultValue"
            initialValue={customization.hasDefaultValue}
          >
            <CollapsibleControl
              title={
                <CheckboxLabel>
                  {t('Dynamic group by has a default value')}
                </CheckboxLabel>
              }
              initialValue={customization.hasDefaultValue}
              onChange={checked => {
                form.setFieldsValue({ hasDefaultValue: checked });
                onUpdate({
                  ...item,
                  customization: {
                    ...customization,
                    hasDefaultValue: checked,
                    defaultDataMask: checked
                      ? (customization.defaultDataMask ?? {})
                      : undefined,
                  },
                });
              }}
            >
              <StyledFormItem
                name="defaultDataMask"
                rules={[
                  {
                    validator: async (_, value) => {
                      const val =
                        value?.filterState?.value ||
                        form.getFieldValue('filters')?.[item.id]?.defaultValue;

                      if (val === null || val === undefined || val === '') {
                        return Promise.reject(
                          new Error(t('Please choose a valid value')),
                        );
                      }
                      return Promise.resolve();
                    },
                  },
                ]}
              >
                <StyledMarginTop>
                  {isDefaultValueLoading ? (
                    <Loading position="inline-centered" />
                  ) : (
                    customization.dataset &&
                    customization.name && (
                      <DefaultValue
                        key={item.id}
                        filterId={item.id}
                        form={form}
                        formData={generatedFormData}
                        setDataMask={setDataMask}
                        hasDataset={!!customization.dataset}
                        enableNoResults
                        hasDefaultValue={
                          !!form.getFieldValue('filters')?.[item.id]
                            ?.defaultValueQueriesData
                        }
                      />
                    )
                  )}
                </StyledMarginTop>
              </StyledFormItem>
            </CollapsibleControl>
          </StyledFormItem>

          <StyledFormItem
            name="isRequired"
            initialValue={customization.isRequired}
          >
            <CollapsibleControl
              title={
                <CheckboxLabel>
                  {t('Dynamic group by value is required')}
                </CheckboxLabel>
              }
              initialValue={customization.isRequired}
              onChange={checked => {
                form.setFieldsValue({ isRequired: checked });
                onUpdate({
                  ...item,
                  customization: { ...customization, isRequired: checked },
                });
              }}
            >
              <div />
            </CollapsibleControl>
          </StyledFormItem>

          <StyledFormItem
            name="selectFirst"
            initialValue={customization.selectFirst}
          >
            <CollapsibleControl
              title={
                <CheckboxLabel>
                  {t('Select first filter value by default')}
                </CheckboxLabel>
              }
              initialValue={customization.selectFirst}
              onChange={checked => {
                form.setFieldsValue({ selectFirst: checked });
                onUpdate({
                  ...item,
                  customization: { ...customization, selectFirst: checked },
                });
              }}
            >
              <div />
            </CollapsibleControl>
          </StyledFormItem>
        </Collapse.Panel>
      </Collapse>
    </StyledForm>
  );
};

export default ChartCustomizationForm;
