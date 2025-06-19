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
import { FC, useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { t, styled, css, SLOW_DEBOUNCE, useTheme } from '@superset-ui/core';
import { debounce } from 'lodash';
import { Form, FormItem } from 'src/components/Form';
import { Input, TextArea } from 'src/components/Input';
import { Radio } from 'src/components/Radio';
import Select from 'src/components/Select/Select';
import Collapse from 'src/components/Collapse';
import { InfoTooltipWithTrigger } from '@superset-ui/chart-controls';
import Loading from 'src/components/Loading';
import { getChartDataRequest } from 'src/components/Chart/chartAction';
import { CollapsibleControl } from '../FiltersConfigModal/FiltersConfigForm/CollapsibleControl';
import { ColumnSelect } from '../FiltersConfigModal/FiltersConfigForm/ColumnSelect';
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
  const theme = useTheme();
  const customization = useMemo(
    () => item.customization || {},
    [item.customization],
  );

  const [metrics, setMetrics] = useState<any[]>([]);
  const [isDefaultValueLoading, setIsDefaultValueLoading] = useState(false);
  const [error, setError] = useState<any>(null);
  const [datasetDetails, setDatasetDetails] = useState<{
    id: number;
    table_name: string;
    schema?: string;
    database?: { database_name: string };
  } | null>(null);

  const fetchedRef = useRef({
    dataset: null,
    column: null,
    hasDefaultValue: false,
  });

  const datasetValue = useMemo(() => {
    if (!customization.dataset) return undefined;

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
      return {
        value: datasetId,
        label:
          datasetDetails.table_name +
          (datasetDetails.schema ? ` (${datasetDetails.schema})` : '') +
          (datasetDetails.database?.database_name
            ? ` [${datasetDetails.database.database_name}]`
            : ''),
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
        return {
          value: datasetId,
          label: (customization.datasetInfo as { table_name: string })
            .table_name,
        };
      }
    }

    return {
      value: datasetId,
      label: `Dataset ${datasetId}`,
    };
  }, [customization.dataset, customization.datasetInfo, datasetDetails]);

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
    () => debounce(formChanged, SLOW_DEBOUNCE),
    [formChanged],
  );

  // Helper function to set form values (similar to setNativeFilterFieldValues in FiltersConfigForm)
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

  const fetchDefaultValueData = useCallback(async () => {
    const formValues = form.getFieldValue('filters')?.[item.id] || {};
    const dataset = formValues.dataset || customization.dataset;
    const column = formValues.column || customization.column;
    const hasDefaultValue =
      formValues.hasDefaultValue ?? customization.hasDefaultValue;
    const isRequired = formValues.isRequired ?? customization.isRequired;

    if (hasDefaultValue && !isRequired) {
      ensureFilterSlot();
      const currentFilters = form.getFieldValue('filters') || {};
      form.setFieldsValue({
        filters: {
          ...currentFilters,
          [item.id]: {
            ...(currentFilters[item.id] || {}),
            hasDefaultValue,
          },
        },
      });

      onUpdate({
        ...item,
        customization: {
          ...customization,
          hasDefaultValue,
        },
      });
    }

    if (!dataset || !column) {
      setIsDefaultValueLoading(false);
      return;
    }

    setIsDefaultValueLoading(true);
    try {
      const datasetId = Number(dataset.value || dataset);
      if (Number.isNaN(datasetId)) {
        throw new Error('Invalid dataset ID');
      }

      const formData = getFormData({
        datasetId,
        dashboardId: 0,
        groupby: column,
        filterType: 'filter_select',
        controlValues: {
          sortAscending:
            formValues.sortAscending ?? customization.sortAscending,
          sortMetric: formValues.sortMetric ?? customization.sortMetric,
        },
      });

      const { json } = await getChartDataRequest({ formData });

      ensureFilterSlot();
      const currentFilters = form.getFieldValue('filters') || {};

      form.setFieldsValue({
        filters: {
          ...currentFilters,
          [item.id]: {
            ...(currentFilters[item.id] || {}),
            defaultValueQueriesData: json.result,
            filterType: 'filter_select',
            hasDefaultValue: true,
          },
        },
      });

      onUpdate({
        ...item,
        customization: {
          ...customization,
          defaultValueQueriesData: json.result,
          hasDefaultValue:
            formValues.hasDefaultValue ?? customization.hasDefaultValue,
        },
      });

      setError(null);
    } catch (error) {
      console.error('Error fetching default value data:', error);
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

    const initialValues = {
      filters: {
        [item.id]: {
          name: customization.name || '',
          description: customization.description || '',
          dataset: customization.dataset
            ? String(
                typeof customization.dataset === 'object' &&
                  customization.dataset !== null
                  ? (customization.dataset as any).value ||
                      customization.dataset
                  : customization.dataset,
              )
            : null,
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

    if (customization.dataset) {
      fetchDatasetInfo();
    }

    // Validate required fields after form initialization (similar to FiltersConfigForm)
    if (customization.isRequired) {
      setTimeout(() => {
        form
          .validateFields([['filters', item.id, 'isRequired']])
          .catch(() => {});
      }, 0);
    }
  }, [item.id, fetchDatasetInfo, customization, form, ensureFilterSlot]);

  useEffect(() => {
    const formValues = form.getFieldValue('filters')?.[item.id] || {};
    const hasDataset = !!formValues.dataset;
    const hasColumn = !!formValues.column;
    const hasDefaultValue = !!formValues.hasDefaultValue;
    const isRequired = !!formValues.isRequired;

    if (hasDataset && fetchedRef.current.dataset !== formValues.dataset) {
      fetchDatasetInfo();
    }

    // Validate required fields when dependencies change (similar to FiltersConfigForm)
    if (isRequired && (!hasDataset || !hasColumn)) {
      setTimeout(() => {
        form
          .validateFields([['filters', item.id, 'isRequired']])
          .catch(() => {});
      }, 0);
    }

    if (
      (hasDefaultValue || isRequired) &&
      hasDataset &&
      hasColumn &&
      (fetchedRef.current.dataset !== formValues.dataset ||
        fetchedRef.current.column !== formValues.column ||
        fetchedRef.current.hasDefaultValue !== hasDefaultValue)
    ) {
      fetchedRef.current = {
        dataset: formValues.dataset,
        column: formValues.column,
        hasDefaultValue,
      };

      fetchDefaultValueData();
    }
  }, [form, item.id, fetchDefaultValueData, fetchDatasetInfo]);

  const setDataMask = useCallback(
    (dataMask: any) => {
      if (!dataMask.filterState) return;

      setFormFieldValues({
        defaultDataMask: dataMask,
        defaultValue: dataMask.filterState?.value,
      });

      // Validate the field after setting the value (similar to FiltersConfigForm)
      setTimeout(() => {
        form
          .validateFields([['filters', item.id, 'defaultDataMask']])
          .catch(() => {});
      }, 0);
    },
    [setFormFieldValues, form, item.id],
  );

  const generatedFormData = useMemo(() => {
    const formValues = form.getFieldValue('filters')?.[item.id] || {};
    const dataset = formValues.dataset || customization.dataset;
    const column = formValues.column || customization.column;

    const datasetId = dataset ? Number(dataset.value || dataset) : undefined;

    return getFormData({
      datasetId,
      groupby: column || '',
      dashboardId: 0,
      filterType: 'filter_select',
      controlValues: {
        sortAscending: formValues.sortAscending ?? customization.sortAscending,
        sortMetric: formValues.sortMetric ?? customization.sortMetric,
      },
    });
  }, [form, item.id, customization]);

  // Add validation for default value when hasDefaultValue is true
  const defaultValueValidator = useCallback(async () => {
    const current = form.getFieldValue(['filters', item.id]) || {};
    if (!current.hasDefaultValue && !current.isRequired) {
      return Promise.resolve();
    }

    const val =
      current.defaultDataMask?.filterState?.value ?? current.defaultValue;
    if (!val) {
      return Promise.reject(new Error(t('Please choose a valid value')));
    }
    return Promise.resolve();
  }, [form, item.id]);

  // Add validation for required fields when isRequired is true
  const isRequiredValidator = useCallback(
    async (_, isRequired) => {
      if (!isRequired) {
        return Promise.resolve();
      }

      const current = form.getFieldValue(['filters', item.id]) || {};
      if (!current.dataset || !current.column) {
        return Promise.reject(
          new Error(
            t(
              'Dataset and column must be selected when "Dynamic group by value is required" is enabled',
            ),
          ),
        );
      }

      return Promise.resolve();
    },
    [form, item.id],
  );

  // Calculate tooltip for hasDefaultValue checkbox (matching FiltersConfigForm logic)
  const getDefaultValueTooltip = useCallback(() => {
    const formValues = form.getFieldValue('filters')?.[item.id] || {};
    const selectFirst = formValues.selectFirst ?? customization.selectFirst;
    const isRequired = formValues.isRequired ?? customization.isRequired;
    const hasDefaultValue =
      formValues.hasDefaultValue ?? customization.hasDefaultValue;

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
  }, [form, item.id, customization]);

  return (
    <StyledForm
      layout="vertical"
      form={form}
      onValuesChange={() => formChanged()}
    >
      <StyledContainer>
        <StyledFormItem
          name={['filters', item.id, 'name']}
          label={t('Name')}
          initialValue={customization.name || ''}
          rules={[{ required: true, message: t('Please enter a name') }]}
        >
          <Input
            placeholder={t('Enter a name for this customization')}
            onChange={debouncedFormChanged}
          />
        </StyledFormItem>

        <StyledFormItem
          name={['filters', item.id, 'dataset']}
          label={
            <>
              {t('Dataset')}&nbsp;
              <InfoTooltipWithTrigger
                tooltip={t('Select the dataset this group by will use')}
                placement="right"
              />
            </>
          }
          initialValue={datasetValue}
          rules={[{ required: true, message: t('Please select a dataset') }]}
        >
          <DatasetSelect
            onChange={(dataset: { label: string; value: number }) => {
              const datasetWithInfo = {
                ...dataset,
                table_name: dataset.label,
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

      <StyledContainer>
        <StyledFormItem
          name={['filters', item.id, 'column']}
          label={
            <>
              <CheckboxLabel>{t('Group by column')}</CheckboxLabel>&nbsp;
              <InfoTooltipWithTrigger
                tooltip={t('Choose the column to group by')}
                placement="right"
              />
            </>
          }
          initialValue={customization.column}
          rules={[{ required: true, message: t('Please select a column') }]}
          css={css`
            width: 100%;
          `}
        >
          <ColumnSelect
            allowClear
            form={form}
            formField="column"
            filterId={item.id}
            filterValues={(column: any) => column.filterable !== false}
            datasetId={(() => {
              const formValues = form.getFieldValue('filters')?.[item.id] || {};
              const dataset = formValues.dataset || customization.dataset;
              if (dataset) {
                if (
                  typeof dataset === 'object' &&
                  dataset !== null &&
                  'value' in dataset
                ) {
                  return Number((dataset as any).value);
                }
                return Number(dataset);
              }
              return undefined;
            })()}
            onChange={(column: string) => {
              setError(null);
              setFormFieldValues({
                column,
                defaultValueQueriesData: null,
                defaultValue: undefined,
                defaultDataMask: null,
              });
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
              title={<CheckboxLabel>{t('Sort filter values')}</CheckboxLabel>}
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
                  }}
                />
              </StyledFormItem>

              {customization.sortFilter && metrics.length > 0 && (
                <StyledFormItem
                  name={['filters', item.id, 'sortMetric']}
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
                    onChange={value => {
                      const stringValue =
                        value !== null && value !== undefined
                          ? String(value)
                          : undefined;

                      setFormFieldValues({
                        sortMetric: stringValue,
                      });
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

          <StyledFormItem name={['filters', item.id, 'defaultValue']}>
            <CollapsibleControl
              checked={
                form.getFieldValue('filters')?.[item.id]?.hasDefaultValue ??
                customization.hasDefaultValue ??
                false
              }
              initialValue={customization.hasDefaultValue ?? false}
              disabled={customization.isRequired || customization.selectFirst}
              title={
                <CheckboxLabel>
                  {t('Dynamic group by has a default value')}
                </CheckboxLabel>
              }
              tooltip={getDefaultValueTooltip()}
              onChange={checked => {
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
                }
              }}
            >
              <StyledFormItem
                name={['filters', item.id, 'defaultDataMask']}
                initialValue={customization.defaultDataMask || null}
                label={<CheckboxLabel>{t('Default Value')}</CheckboxLabel>}
                required={customization.hasDefaultValue}
                rules={[
                  {
                    validator: defaultValueValidator,
                  },
                ]}
              >
                <StyledMarginTop>
                  {(() => {
                    const currentFilters = form.getFieldValue('filters') || {};
                    const currentItemValues = currentFilters[item.id] || {};

                    const hasDatasetAndColumn =
                      !!currentItemValues.dataset && !!currentItemValues.column;
                    const showDefaultValue =
                      !hasDatasetAndColumn ||
                      (!isDefaultValueLoading &&
                        hasDatasetAndColumn &&
                        currentItemValues.defaultValueQueriesData);

                    if (error) {
                      return (
                        <div style={{ color: theme.colors.error.base }}>
                          {t('Cannot load filter: ')}{' '}
                          {error.message || error.error || 'Unknown error'}
                        </div>
                      );
                    }

                    if (isDefaultValueLoading) {
                      return <Loading position="inline-centered" />;
                    }

                    if (!hasDatasetAndColumn) {
                      return (
                        <div>
                          {t(
                            'Fill all required fields to enable "Default Value"',
                          )}
                        </div>
                      );
                    }

                    if (
                      showDefaultValue &&
                      currentItemValues.defaultValueQueriesData
                    ) {
                      return (
                        <DefaultValue
                          key={`${item.id}-${currentItemValues.dataset}-${currentItemValues.column}`}
                          filterId={item.id}
                          form={form}
                          formData={generatedFormData}
                          setDataMask={setDataMask}
                          hasDataset
                          enableNoResults
                          hasDefaultValue={currentItemValues.hasDefaultValue}
                        />
                      );
                    }

                    return <div>{t('Loading default value options...')}</div>;
                  })()}
                </StyledMarginTop>
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
              checked={customization.isRequired || false}
              title={
                <CheckboxLabel>
                  {t('Dynamic group by value is required')}
                </CheckboxLabel>
              }
              tooltip={t('User must select a value before applying the filter')}
              onChange={checked => {
                setFormFieldValues({
                  isRequired: checked,
                  ...(checked
                    ? {
                        hasDefaultValue: false,
                        defaultDataMask: null,
                        defaultValue: undefined,
                        defaultValueQueriesData: null,
                      }
                    : {}),
                });
              }}
            >
              <div>
                {customization.isRequired && (
                  <>
                    <div
                      style={{
                        marginTop: 8,
                        color: theme.colors.grayscale.base,
                      }}
                    >
                      {t(
                        'Users will need to select a value before they can see the filtered data',
                      )}
                    </div>
                    {(() => {
                      if (isDefaultValueLoading || error) {
                        return (
                          <StyledMarginTop>
                            {isDefaultValueLoading ? (
                              <Loading position="inline-centered" />
                            ) : error ? (
                              <div style={{ color: theme.colors.error.base }}>
                                {t('Cannot load filter values: ')}{' '}
                                {error.message ||
                                  error.error ||
                                  'Unknown error'}
                              </div>
                            ) : null}
                          </StyledMarginTop>
                        );
                      }
                      return null;
                    })()}
                  </>
                )}
              </div>
            </CollapsibleControl>
          </StyledFormItem>

          <StyledFormItem name={['filters', item.id, 'selectFirst']}>
            <CollapsibleControl
              checked={customization.selectFirst || false}
              title={
                <CheckboxLabel>
                  {t('Select first filter value by default')}
                  <InfoTooltipWithTrigger
                    placement="top"
                    tooltip={t(
                      'Default value set automatically when this option is checked',
                    )}
                  />
                </CheckboxLabel>
              }
              onChange={checked => {
                setFormFieldValues({
                  selectFirst: checked,
                  ...(checked
                    ? {
                        hasDefaultValue: false,
                        defaultDataMask: null,
                        defaultValue: undefined,
                        defaultValueQueriesData: null,
                      }
                    : {}),
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
