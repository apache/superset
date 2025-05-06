import { FC, useEffect, useMemo, useState, useRef } from 'react';
import { t, styled, css } from '@superset-ui/core';
import { Form, FormItem } from 'src/components/Form';
import { Input, TextArea } from 'src/components/Input';
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

  useEffect(() => {
    form.setFieldsValue(customization);
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

    const datasetId = parseInt(customization.dataset, 10);
    return datasetId
      ? { value: datasetId, label: `Dataset ${datasetId}` }
      : undefined;
  }, [customization.dataset]);

  // Fetch metrics when dataset changes
  useEffect(() => {
    const fetchMetrics = async () => {
      if (!customization.dataset) {
        setMetrics([]);
        setHasMetrics(false);
        return;
      }

      try {
        const datasetId = parseInt(customization.dataset.toString(), 10);
        if (Number.isNaN(datasetId)) return;

        const response = await fetch(`/api/v1/dataset/${datasetId}`);
        const data = await response.json();

        if (data?.result?.metrics) {
          setMetrics(data.result.metrics);
          setHasMetrics(data.result.metrics.length > 0);
        } else {
          setMetrics([]);
          setHasMetrics(false);
        }
      } catch (error) {
        console.error('Error fetching metrics:', error);
        setMetrics([]);
        setHasMetrics(false);
      }
    };

    fetchMetrics();
  }, [customization.dataset]);

  // Add a ref to track if we've already fetched data for this combination
  const fetchedRef = useRef<{
    datasetId?: string;
    columnName?: string;
    hasDefaultValue?: boolean;
  }>({});

  // Fetch default value data when needed fields change
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
        return; // Skip if we've already fetched for this combination
      }

      // Update our ref to remember what we're fetching
      fetchedRef.current = {
        datasetId,
        columnName: customization.name,
        hasDefaultValue: customization.hasDefaultValue,
      };

      setIsDefaultValueLoading(true);
      try {
        // Get the dataset ID as a number
        const datasetIdNum = parseInt(datasetId, 10);
        if (Number.isNaN(datasetIdNum)) {
          throw new Error('Invalid dataset ID');
        }

        // Create a proper formData object using the utility function
        const formData = getFormData({
          datasetId: datasetIdNum,
          dashboardId: 0, // Use 0 as a placeholder if not in a dashboard context
          groupby: customization.name,
          filterType: 'filter_select',
          controlValues: {
            sortAscending: customization.sortAscending,
            sortMetric: customization.sortMetric,
          },
        });

        console.log('Chart data request payload:', {
          formData,
        });

        // Use Superset's getChartDataRequest utility
        try {
          const { json } = await getChartDataRequest({
            formData,
          });

          // Process the response
          const responseData = json;

          // Update the form with the query results
          form.setFieldsValue({
            filters: {
              [item.id]: {
                defaultValueQueriesData: responseData.result,
                filterType: 'filter_select',
                column: customization.name,
              },
            },
          });

          // Create an initial data mask with empty value
          const initialDataMask = {
            filterState: {
              value: null,
            },
            extraFormData: {},
          };

          // Update the customization with the data mask
          onUpdate({
            ...item,
            customization: {
              ...customization,
              defaultDataMask: initialDataMask,
            },
          });
        } catch (error) {
          console.error('Error fetching default value data:', error);
        } finally {
          setIsDefaultValueLoading(false);
        }
      } catch (error) {
        console.error('Error fetching default value data:', error);
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

  // Function to handle data mask changes from the DefaultValue component
  const setDataMask = (dataMask: any) => {
    if (!dataMask.filterState) return;

    // Update the form with the new data mask
    const filtersValue = form.getFieldValue('filters') || {};
    form.setFieldsValue({
      filters: {
        ...filtersValue,
        [item.id]: {
          ...(filtersValue[item.id] || {}),
          defaultDataMask: dataMask,
        },
      },
    });

    // Update the customization with the new data mask and value
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
          label={t('Dynamic group by name')}
          rules={[{ required: true, message: t('Please enter a name') }]}
        >
          <Input />
        </StyledFormItem>

        <StyledFormItem
          name="dataset"
          label={t('Dataset')}
          rules={[{ required: true, message: t('Please select a dataset') }]}
        >
          <DatasetSelect
            value={datasetValue}
            onChange={(dataset: { label: string; value: number }) => {
              // Store the dataset ID as a string in the customization
              const datasetId = dataset.value.toString();
              // Get the current name value from the form to preserve it
              const currentName = form.getFieldValue('name');

              // Check if the dataset has changed
              const datasetChanged = customization.dataset !== datasetId;

              // Update only the dataset field in the form
              form.setFieldsValue({ dataset: datasetId });

              // Reset the fetchedRef to force a new data fetch when needed
              if (datasetChanged) {
                fetchedRef.current = {};

                // Reset any default value data in the form when dataset changes
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

              // Update the customization with both the dataset and preserving the name
              onUpdate({
                ...item,
                customization: {
                  ...customization,
                  dataset: datasetId,
                  name: currentName || customization.name, // Preserve the name
                  // Reset default value related fields if dataset changed
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

          <StyledFormItem name="sortFilter">
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

          <StyledFormItem name="hasDefaultValue">
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
                      const val = value?.filterState?.value;
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

          <StyledFormItem name="isRequired">
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

          <StyledFormItem name="selectFirst">
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
