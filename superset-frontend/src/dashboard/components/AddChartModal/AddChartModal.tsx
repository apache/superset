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
import React, { useState, useMemo } from 'react';
import {
  styled,
  css,
  t,
  SupersetClient,
  QueryFormData,
} from '@superset-ui/core';
import {
  Modal,
  AsyncSelect,
  Select,
  Button,
  EmptyState,
} from '@superset-ui/core/components';
import { fetchExploreData } from 'src/pages/Chart';
import Chart from 'src/dashboard/components/gridComponents/Chart';
import { useDispatch } from 'react-redux';
import { addChart } from 'src/components/Chart/chartAction';
import { fetchDatasourceMetadata } from 'src/dashboard/actions/datasources';
import { addSlice } from 'src/dashboard/actions/dashboardState';
import { addSlices } from 'src/dashboard/actions/sliceEntities';
import { ChartState } from 'src/explore/types';
import { getChartRequiredFieldsMissingMessage } from 'src/utils/getChartRequiredFieldsMissingMessage';

interface FormData {
  vizType: string;
  title: string;
  description: string;
  dataset: any;
  metric: string;
  groupBy: string;
}

interface AddChartModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (formData: FormData) => void;
}

interface DatasourceOption {
  value: string;
  label: string;
  id: string;
  customLabel?: string;
  explore_url?: string;
}

interface MetricOption {
  id?: number;
  metric_name: string;
  verbose_name?: string;
  expression?: string;
  description?: string;
}

interface ColumnOption {
  id?: number;
  column_name: string;
  verbose_name?: string;
  type?: string;
  groupby?: boolean;
  filterable?: boolean;
  description?: string;
}

interface SelectOption {
  value: string;
  label: string;
}

const DEFAULT_PIE_FORM_DATA = {
  adhoc_filters: [],
  color_scheme: 'supersetColors',
  datasource: null,
  donut: true,
  granularity_sqla: 'time_start',
  groupby: null,
  innerRadius: 44,
  label_line: true,
  labels_outside: true,
  metric: 'count',
  number_format: 'SMART_NUMBER',
  outerRadius: 69,
  label_type: 'key',
  queryFields: {
    groupby: 'groupby',
    metric: 'metrics',
  },
  row_limit: 10000,
  show_labels: true,
  show_legend: false,
  slice_id: null,
  time_range: 'No filter',
  url_params: {},
  viz_type: 'pie',
  annotation_layers: [],
};

const ADD_CHART_STATE: ChartState & {
  form_data: QueryFormData | null;
} = {
  id: 7,
  chartAlert: null,
  chartStatus: 'loading',
  chartStackTrace: null,
  chartUpdateEndTime: null,
  chartUpdateStartTime: 0,
  latestQueryFormData: {},
  sliceFormData: null,
  queryController: null,
  queriesResponse: null,
  triggerQuery: true,
  lastRendered: 0,
  form_data: null,
};

const ADD_CHART_KEY = 7;

const ModalContent = styled.div`
  ${({ theme }) => css`
    display: flex;
    height: 80vh;
    max-height: 800px;

    .left-panel {
      flex: 1;
      padding: ${theme.sizeUnit * 6}px;
      border-right: 1px solid ${theme.colorBorderSecondary};
      overflow-y: auto;

      .form-section {
        margin-bottom: ${theme.sizeUnit * 6}px;

        .section-title {
          font-size: ${theme.fontSize}px;
          font-weight: ${theme.fontWeightStrong};
          color: ${theme.colorText};
          margin-bottom: ${theme.sizeUnit * 3}px;
        }

        .viz-type-buttons {
          display: flex;
          flex-wrap: wrap;
          gap: ${theme.sizeUnit * 2}px;
          margin-bottom: ${theme.sizeUnit * 3}px;

          .viz-button {
            padding: ${theme.sizeUnit * 2}px ${theme.sizeUnit * 3}px;
            border: 1px solid ${theme.colorBorderSecondary};
            border-radius: ${theme.borderRadius}px;
            background: ${theme.colorBgContainer};
            color: ${theme.colorText};
            cursor: pointer;
            font-size: ${theme.fontSizeSM}px;
            transition: all 0.2s ease;

            &:hover {
              border-color: ${theme.colors.primary.base};
            }

            &.active {
              background: ${theme.colors.primary.base};
              color: ${theme.colorWhite};
              border-color: ${theme.colors.primary.base};
            }
          }
        }

        .form-field {
          margin-bottom: ${theme.sizeUnit * 4}px;

          label {
            display: block;
            font-size: ${theme.fontSizeSM}px;
            font-weight: ${theme.fontWeightNormal};
            color: ${theme.colorText};
            margin-bottom: ${theme.sizeUnit}px;
          }

          input,
          textarea {
            width: 100%;
            padding: ${theme.sizeUnit * 2}px ${theme.sizeUnit * 3}px;
            border: 1px solid ${theme.colorBorderSecondary};
            border-radius: ${theme.borderRadius}px;
            font-size: ${theme.fontSizeSM}px;
            color: ${theme.colorText};
            background: ${theme.colorBgContainer};

            &:focus {
              outline: none;
              border-color: ${theme.colors.primary.base};
            }
          }

          textarea {
            min-height: 80px;
            resize: vertical;
          }

          /* Select Styling */
          .select-container {
            .Select__control {
              min-height: ${theme.controlHeight}px;
              padding: 0;
              border: 1px solid ${theme.colorBorderSecondary};
              border-radius: ${theme.borderRadius}px;
              background: ${theme.colorBgContainer};
              box-shadow: none;
              transition: border-color 0.2s ease;

              &:hover {
                border-color: ${theme.colors.primary.base};
              }

              &--is-focused {
                border-color: ${theme.colors.primary.base};
                box-shadow: 0 0 0 2px ${theme.colors.primary.light4};
              }

              &--menu-is-open {
                border-color: ${theme.colors.primary.base};
              }
            }

            .Select__value-container {
              padding: 0 ${theme.sizeUnit * 3}px;

              .Select__placeholder {
                color: ${theme.colorTextPlaceholder};
                font-size: ${theme.fontSizeSM}px;
              }

              .Select__single-value {
                color: ${theme.colorText};
                font-size: ${theme.fontSizeSM}px;
              }

              .Select__input-container {
                color: ${theme.colorText};
                font-size: ${theme.fontSizeSM}px;
              }
            }

            .Select__indicators {
              .Select__dropdown-indicator {
                padding: ${theme.sizeUnit * 2}px;
                color: ${theme.colorTextSecondary};

                &:hover {
                  color: ${theme.colorText};
                }
              }

              .Select__clear-indicator {
                padding: ${theme.sizeUnit * 2}px;
                color: ${theme.colorTextSecondary};

                &:hover {
                  color: ${theme.colorText};
                }
              }

              .Select__loading-indicator {
                padding: ${theme.sizeUnit * 2}px;
              }
            }

            .Select__menu {
              background: ${theme.colorBgContainer};
              border: 1px solid ${theme.colorBorderSecondary};
              border-radius: ${theme.borderRadius}px;
              box-shadow: ${theme.boxShadow};
              z-index: 1000;

              .Select__menu-list {
                padding: ${theme.sizeUnit}px 0;

                .Select__option {
                  padding: ${theme.sizeUnit * 2}px ${theme.sizeUnit * 3}px;
                  font-size: ${theme.fontSizeSM}px;
                  color: ${theme.colorText};
                  background: transparent;
                  cursor: pointer;

                  &:hover,
                  &--is-focused {
                    background: ${theme.colors.primary.light5};
                    color: ${theme.colorText};
                  }

                  &--is-selected {
                    background: ${theme.colors.primary.base};
                    color: ${theme.colorWhite};

                    &:hover {
                      background: ${theme.colors.primary.dark1};
                    }
                  }
                }

                .Select__no-options-message {
                  padding: ${theme.sizeUnit * 3}px;
                  color: ${theme.colorTextSecondary};
                  font-size: ${theme.fontSizeSM}px;
                  text-align: center;
                }

                .Select__loading-message {
                  padding: ${theme.sizeUnit * 3}px;
                  color: ${theme.colorTextSecondary};
                  font-size: ${theme.fontSizeSM}px;
                  text-align: center;
                }
              }
            }
          }
        }
      }
    }

    .right-panel {
      flex: 1;
      padding: ${theme.sizeUnit * 6}px;
      background: ${theme.colors.grayscale.light5};
      display: flex;
      flex-direction: column;

      .preview-title {
        font-size: ${theme.fontSize}px;
        font-weight: ${theme.fontWeightStrong};
        color: ${theme.colorText};
        margin-bottom: ${theme.sizeUnit * 4}px;
      }

      .chart-preview {
        flex: 1;
        background: ${theme.colorBgContainer};
        border: 1px solid ${theme.colorBorderSecondary};
        border-radius: ${theme.borderRadius}px;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: ${theme.sizeUnit * 4}px;
        min-height: 300px;

        .preview-chart {
          display: flex;
          align-items: flex-end;
          gap: ${theme.sizeUnit * 2}px;
          height: 150px;

          .bar {
            width: 40px;
            background: ${theme.colors.primary.base};
            border-radius: ${theme.borderRadiusXS}px ${theme.borderRadiusXS}px 0
              0;

            &:nth-child(1) {
              height: 80px;
            }
            &:nth-child(2) {
              height: 60px;
            }
            &:nth-child(3) {
              height: 100px;
            }
            &:nth-child(4) {
              height: 45px;
            }
            &:nth-child(5) {
              height: 120px;
            }
          }
        }

        .preview-line-chart {
          width: 200px;
          height: 120px;
          position: relative;

          svg {
            width: 100%;
            height: 100%;

            .line {
              stroke: ${theme.colors.primary.base};
              stroke-width: 3;
              fill: none;
            }

            .dot {
              fill: ${theme.colors.primary.base};
            }
          }
        }

        .preview-pie-chart {
          width: 120px;
          height: 120px;
          border-radius: 50%;
          background: conic-gradient(
            ${theme.colors.primary.base} 0deg 120deg,
            ${theme.colors.primary.light2} 120deg 200deg,
            ${theme.colors.primary.light3} 200deg 280deg,
            ${theme.colors.primary.light4} 280deg 360deg
          );
        }

        .preview-table {
          .table-header {
            display: flex;
            background: ${theme.colors.grayscale.light4};
            border-radius: ${theme.borderRadius}px ${theme.borderRadius}px 0 0;

            .header-cell {
              flex: 1;
              padding: ${theme.sizeUnit * 2}px;
              font-weight: ${theme.fontWeightStrong};
              border-right: 1px solid ${theme.colorBorderSecondary};

              &:last-child {
                border-right: none;
              }
            }
          }

          .table-row {
            display: flex;
            border-bottom: 1px solid ${theme.colorBorderSecondary};

            .table-cell {
              flex: 1;
              padding: ${theme.sizeUnit * 2}px;
              border-right: 1px solid ${theme.colorBorderSecondary};

              &:last-child {
                border-right: none;
              }
            }
          }
        }

        .no-datasource-message {
          text-align: center;
          color: ${theme.colorTextSecondary};
          font-style: italic;
        }
      }

      .config-summary {
        .summary-title {
          font-size: ${theme.fontSizeSM}px;
          font-weight: ${theme.fontWeightStrong};
          color: ${theme.colorText};
          margin-bottom: ${theme.sizeUnit * 2}px;
        }

        .summary-item {
          font-size: ${theme.fontSizeSM}px;
          color: ${theme.colorTextSecondary};
          margin-bottom: ${theme.sizeUnit}px;

          strong {
            color: ${theme.colorText};
          }
        }
      }
    }

    .modal-footer {
      position: absolute;
      bottom: 0;
      right: 0;
      padding: ${theme.sizeUnit * 4}px ${theme.sizeUnit * 6}px;
      background: ${theme.colorBgContainer};
      border-top: 1px solid ${theme.colorBorderSecondary};
      display: flex;
      gap: ${theme.sizeUnit * 3}px;

      button {
        padding: ${theme.sizeUnit * 2}px ${theme.sizeUnit * 4}px;
        border-radius: ${theme.borderRadius}px;
        font-size: ${theme.fontSizeSM}px;
        cursor: pointer;
        border: 1px solid transparent;

        &.cancel-btn {
          background: ${theme.colors.grayscale.light4};
          color: ${theme.colorText};
          border-color: ${theme.colorBorderSecondary};

          &:hover {
            background: ${theme.colors.grayscale.light3};
          }
        }

        &.save-btn {
          background: ${theme.colors.primary.base};
          color: ${theme.colorWhite};

          &:hover {
            background: ${theme.colors.primary.dark1};
          }

          &:disabled {
            background: ${theme.colors.grayscale.light3};
            cursor: not-allowed;
          }
        }
      }
    }
  `}
`;

const AddChartModal: React.FC<AddChartModalProps> = ({
  isOpen,
  onClose,
  onSave,
}) => {
  const [formData, setFormData] = useState<FormData>({
    vizType: 'Pie Chart',
    title: 'Monthly Revenue by Region',
    description: 'Breakdown of revenue by geographic region',
    dataset: null,
    metric: '',
    groupBy: '',
  });

  const portableChartProps = {
    componentId: 'CHART-KltoVNVW0LvnQ27LL0kdD',
    id: 7,
    width: 499,
    height: 508,
    // sliceName: 'Weekly Messages',
    isComponentVisible: true,
    isFullSize: false,
    extraControls: {},
    isInView: true,
    handleToggleFullSize: () => {},
    updateSliceName: () => {},
    setControlValue: () => {},
  };

  const dispatch = useDispatch();

  const [selectedDatasource, setSelectedDatasource] =
    useState<DatasourceOption | null>(null);
  const [availableMetrics, setAvailableMetrics] = useState<MetricOption[]>([]);
  const [availableColumns, setAvailableColumns] = useState<ColumnOption[]>([]);
  const [chartLoading, setChartLoading] = useState(true);

  const vizTypes = ['Pie Chart'];

  // Memoized options for Select components
  const metricOptions: SelectOption[] = useMemo(
    () =>
      availableMetrics.map(metric => ({
        value: metric.metric_name,
        label: `${metric.verbose_name || metric.metric_name}${metric.description ? ` - ${metric.description}` : ''}`,
      })),
    [availableMetrics],
  );

  const columnOptions: SelectOption[] = useMemo(
    () =>
      availableColumns.map(column => ({
        value: column.column_name,
        label: `${column.verbose_name || column.column_name}${column.type ? ` (${column.type})` : ''}`,
      })),
    [availableColumns],
  );

  // Function to get viz_type based on selected chart type
  const getVizType = (chartType: string): string => {
    const vizTypeMap: { [key: string]: string } = {
      'Bar Chart': 'echarts_timeseries_bar',
      'Line Chart': 'echarts_timeseries_line',
      'Pie Chart': 'pie',
      'Area Chart': 'echarts_area',
      'Scatter Plot': 'scatter',
      'Table View': 'table',
    };
    return vizTypeMap[chartType] || 'echarts_timeseries_bar';
  };

  // Function to fetch explore data using the shared fetchExploreData function
  const fetchDatasourceExploreData = async (
    datasource: DatasourceOption,
    vizType: string = 'echarts_timeseries_bar',
  ) => {
    try {
      console.log(`Fetching explore data for datasource: ${datasource.label}`);
      console.log(`Datasource ID: ${datasource.value}, Viz Type: ${vizType}`);

      // Create URLSearchParams with the required parameters
      const exploreUrlParams = new URLSearchParams({
        // form_data_key: '62wJO6INGOQ',
        viz_type: vizType,
        datasource_id: datasource.value,
        datasource_type: 'table',
      });

      console.log('Explore URL Params:', exploreUrlParams.toString());

      // Use the shared fetchExploreData function
      const response = await fetchExploreData(exploreUrlParams);
      const result = response?.result;

      console.log('Explore API Response:', result);

      // Extract metrics and columns from the response
      if (result?.dataset) {
        const metrics = result.dataset.metrics || [];
        const columns = result.dataset.columns || [];

        console.log('Available metrics:', metrics);
        console.log('Available columns:', columns);

        // Update state with available metrics and columns
        setAvailableMetrics(metrics);
        setAvailableColumns(columns.filter((col: ColumnOption) => col.groupby)); // Only groupable columns

        console.log(
          'Metric names:',
          metrics.map((metric: any) => metric.metric_name),
        );
        console.log(
          'Groupable column names:',
          columns
            .filter((col: any) => col.groupby)
            .map((col: any) => col.column_name),
        );
      }

      return result;
    } catch (error) {
      console.error('Error fetching explore data:', error);
      // Reset metrics and columns on error
      setAvailableMetrics([]);
      setAvailableColumns([]);
      return null;
    }
  };

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleDatasourceChange = async (value: any, dt) => {
    console.log(value, dt);
    const datasource = value as DatasourceOption | null;
    setSelectedDatasource(datasource);
    setFormData(prev => ({
      ...prev,
      dataset: datasource,
      // Reset metric and groupBy when datasource changes
      metric: '',
      groupBy: '',
    }));

    // Reset available options when datasource changes
    setAvailableMetrics([]);
    setAvailableColumns([]);

    // Fetch explore data using the shared function
    if (datasource?.value) {
      const currentVizType = getVizType(formData.vizType);
      await fetchDatasourceExploreData(datasource, currentVizType);
    }
  };

  const handleVizTypeChange = async (vizType: string) => {
    handleInputChange('vizType', vizType);

    // If datasource is selected, fetch new explore data with the new viz type
    if (selectedDatasource?.value) {
      const newVizType = getVizType(vizType);
      await fetchDatasourceExploreData(selectedDatasource, newVizType);
    }
  };

  const handleMetricChange = (option: SelectOption | null) => {
    handleInputChange('metric', option || '');
  };

  const handleGroupByChange = (option: SelectOption | null) => {
    handleInputChange('groupBy', option || '');
  };

  const loadDatasources = async (
    search: string,
    page: number,
    pageSize: number,
  ) => {
    try {
      const queryParams = new URLSearchParams({
        q: search,
        page_size: pageSize.toString(),
        page: page.toString(),
      }).toString();

      const response = await SupersetClient.get({
        endpoint: `/api/v1/dataset/?${queryParams}`,
      });

      const options = response.json.result.map((dataset: any) => ({
        value: dataset.id.toString(),
        label: dataset.table_name,
        id: dataset.id.toString(),
        customLabel: `${dataset.database.database_name}: ${dataset.table_name}`,
        explore_url: dataset.explore_url,
      }));

      return {
        data: options,
        totalCount: response.json.count,
      };
    } catch (error) {
      console.error('Error loading datasources:', error);
      return {
        data: [],
        totalCount: 0,
      };
    }
  };

  const createSliceObject = formData => {
    const dummySliceObj = {
      slice_id: null,
      slice_url: null,
      slice_name: '',
      form_data: null,
      datasource: '',
      change_on: 0,
      description: null,
      description_markdown: '',
      viz_type: null,
      modified: '',
      changed_on_humanized: '',
      thumbnail_url: '',
      owners: [],
      created_by: null,
    };
    dummySliceObj.form_data = formData;
    dummySliceObj.viz_type = formData?.viz_type;
    dummySliceObj.slice_id = formData?.slice_id;
    dummySliceObj.datasource = formData?.datasource;
    return dummySliceObj;
  };

  const handleSave = async () => {
    // before coming here we need to construct the form data for all actions with
    // required info
    console.log({
      formData,
    });
    const vizFormData = DEFAULT_PIE_FORM_DATA;
    vizFormData.groupby = [formData?.groupBy];
    vizFormData.metric = formData?.metric;
    vizFormData.datasource = `${formData.dataset.key}__table`;
    vizFormData.slice_id = ADD_CHART_KEY;
    const newChartState = ADD_CHART_STATE;
    newChartState.form_data = vizFormData;

    const actions = [
      dispatch(addChart(newChartState, ADD_CHART_KEY)),
      dispatch(fetchDatasourceMetadata(newChartState.form_data.datasource)),
    ];
    await Promise.all(actions).then(() => {
      const sliceObject = createSliceObject(newChartState.form_data);
      dispatch(
        addSlices({
          // @ts-ignore
          [sliceObject.slice_id]: sliceObject,
        }),
      );
      addSlice({ slice_id: newChartState.id });
      setChartLoading(false);
    });

    // onSave(formData);
  };

  const renderChartPreview = () => {
    if (chartLoading)
      return (
        <div>
          <EmptyState
            size="large"
            title={t('Add required control values to preview chart')}
            description={getChartRequiredFieldsMissingMessage(true)}
            image="chart.svg"
          />
        </div>
      );
    return <Chart {...portableChartProps} sliceName={formData.title} />;
  };

  return (
    <Modal
      show={isOpen}
      onHide={onClose}
      title={t('Edit Chart')}
      width="1200px"
    >
      <ModalContent>
        <div className="left-panel">
          <div className="form-section">
            <div className="section-title">{t('Visualization Type')}</div>
            <div className="viz-type-buttons">
              {vizTypes.map(type => (
                <button
                  key={type}
                  className={`viz-button ${formData.vizType === type ? 'active' : ''}`}
                  onClick={() => handleVizTypeChange(type)}
                  type="button"
                >
                  {t(type)}
                </button>
              ))}
            </div>
          </div>

          <div className="form-section">
            <div className="form-field">
              <label>{t('Chart Title')}</label>
              <input
                type="text"
                value={formData.title}
                onChange={e => handleInputChange('title', e.target.value)}
                placeholder={t('Enter chart title')}
              />
            </div>

            <div className="form-field">
              <label>{t('Description (optional)')}</label>
              <textarea
                value={formData.description}
                onChange={e => handleInputChange('description', e.target.value)}
                placeholder={t('Enter chart description')}
              />
            </div>

            <div className="form-field">
              <label>{t('Dataset')}</label>
              <AsyncSelect
                className="select-container"
                classNamePrefix="Select"
                autoFocus
                ariaLabel={t('Dataset')}
                name="select-datasource"
                onChange={handleDatasourceChange}
                options={loadDatasources}
                optionFilterProps={['id', 'customLabel']}
                placeholder={t('Choose a dataset')}
                showSearch
                value={selectedDatasource}
                isClearable
                isSearchable
              />
            </div>

            {/* Only show Metric and Group By if datasource is selected */}
            {selectedDatasource && (
              <>
                <div className="form-field">
                  <label>{t('Metric')}</label>
                  <Select
                    className="select-container"
                    classNamePrefix="Select"
                    options={metricOptions}
                    value={
                      metricOptions.find(
                        option => option.value === formData.metric,
                      ) || null
                    }
                    onChange={handleMetricChange}
                    placeholder={t('Select a metric')}
                    isClearable
                    isSearchable
                  />
                </div>

                <div className="form-field">
                  <label>{t('Group By')}</label>
                  <Select
                    className="select-container"
                    classNamePrefix="Select"
                    options={columnOptions}
                    value={
                      columnOptions.find(
                        option => option.value === formData.groupBy,
                      ) || null
                    }
                    onChange={handleGroupByChange}
                    placeholder={t('Select a dimension')}
                    isClearable
                    isSearchable
                  />
                </div>
              </>
            )}
          </div>
        </div>

        <div className="right-panel">
          <div className="preview-title">{t('Chart Preview')}</div>

          <div className="chart-preview">{renderChartPreview()}</div>
          {console.log(formData, 'temp form data')}

          <div className="config-summary">
            <div className="summary-title">{t('Configuration Summary')}</div>
            <div className="summary-item">
              <strong>{t('Dataset:')}</strong>{' '}
              {selectedDatasource?.label || t('Not selected')}
            </div>
            {selectedDatasource && (
              <>
                <div className="summary-item">
                  <strong>{t('Metric:')}</strong>{' '}
                  {formData.metric || t('Not selected')}
                </div>
                <div className="summary-item">
                  <strong>{t('Group By:')}</strong>{' '}
                  {formData.groupBy || t('Not selected')}
                </div>
                <div className="summary-item">
                  <strong>{t('Available Metrics:')}</strong>{' '}
                  {availableMetrics.length}
                </div>
                <div className="summary-item">
                  <strong>{t('Available Dimensions:')}</strong>{' '}
                  {availableColumns.length}
                </div>
              </>
            )}
            <div className="summary-item">
              <strong>{t('Visualization:')}</strong> {formData.vizType}
            </div>
          </div>
        </div>
      </ModalContent>

      <div>
        <Button
          // type="Button"
          className="cancel-btn"
          onClick={onClose}
        >
          {t('Cancel')}
        </Button>
        <Button
          // type="Button"
          className="save-btn"
          onClick={handleSave}
          disabled={
            !selectedDatasource || !formData.metric || !formData.groupBy
          }
        >
          {t('Create Chart')}
        </Button>
      </div>
    </Modal>
  );
};

export default AddChartModal;
