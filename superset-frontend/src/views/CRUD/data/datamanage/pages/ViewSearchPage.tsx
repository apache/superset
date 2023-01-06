import React, { useState, useCallback, useEffect } from 'react';
import { Row, Input, Col, Typography, Space, Button, AutoComplete } from 'antd';
import {
  ShareAltOutlined,
  SaveOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import {
  SupersetClient,
  SupersetTheme,
  useTheme,
  css,
} from '@superset-ui/core';
import type { SelectProps } from 'antd/es/select';

import { useResizeDetector } from 'react-resize-detector';
import ChartContainer from 'src/components/Chart/ChartContainer';
import { DataTablesPane } from 'src/explore/components/DataTablesPane/index';
import { FeatureFlag, isFeatureEnabled } from 'src/featureFlags';
import {
  getItem,
  setItem,
  LocalStorageKeys,
} from 'src/utils/localStorageHelpers';

const INITIAL_SIZES: [number, number] = [100, 0];
const ViewSearchPage = () => {
  const theme: SupersetTheme = useTheme();
  const [options, setOptions] = useState<SelectProps<object>['options']>([]);
  const [answer, setAnswer] = useState<any>({});
  const [chartData, setChartData] = useState<any>({});
  const [questionLists, setQuestionLists] = useState([]);
  const [queriesResponse, setQueriesResponse] = useState<any>([]);
  const handleInputChange = () => {
    SupersetClient.get({
      endpoint: '/api/v1/quotron/auto_complete/',
    }).then(async ({ json = {} }) => {
      setQuestionLists(json.result);
    });
  };
  const handleSearch = (value: string) => {
    setOptions(value ? searchResult(value) : []);
  };
  const searchResult = (query: string) =>
    [...questionLists].map((value: any, idx) => {
      const category = `${value.question}`;
      return {
        value: category,
        label: (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <span>{category}</span>
          </div>
        ),
      };
    });

  const onSelect = (value: string) => {
    handleAnswer(value);
  };
  const handleAnswer = (ev: string) => {
    SupersetClient.post({
      endpoint: '/api/v1/quotron/answer/',
      headers: {
        accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        question: `${ev}`,
      }),
    }).then(async ({ json = {} }) => {
      setAnswer(json);
    });
  };
  useEffect(() => {
    if (answer.result) {
      handleChart(answer.result.slice_id);
      handleQueriesResponse(answer.result.slice_id);
    }
  }, [answer]);
  const handleChart = (slice_id: number) => {
    SupersetClient.get({
      endpoint: `/api/v1/explore?slice_id=${slice_id}`,
    }).then(async ({ json = {} }) => {
      setChartData(json.result);
    });
  };
  const handleQueriesResponse = (slice_id: number) => {
    SupersetClient.get({
      endpoint: `/api/v1/chart/${slice_id}/data/?force=false`,
    }).then(async ({ json = {} }) => {
      setQueriesResponse(json.result);
    });
  };
  const { Title } = Typography;
  const chartAlert = null;
  const chartStackTrace = null;
  const chartStatus = 'rendered';
  const triggerRender = false;
  const force = false;
  const errorMessage = null;
  const chartIsStale = false;
  const timeout = 60;
  const datasource = chartData.dataset;
  const formData = chartData.form_data;
  const vizType = 'table';
  const ownState = '';
  const DEFAULT_SOUTH_PANE_HEIGHT_PERCENT = 40;
  const {
    width: chartPanelWidth,
    height: chartPanelHeight,
    ref: chartPanelRef,
  } = useResizeDetector({
    refreshMode: 'debounce',
    refreshRate: 300,
  });
  const [splitSizes, setSplitSizes] = useState<any>(
    isFeatureEnabled(FeatureFlag.DATAPANEL_CLOSED_BY_DEFAULT)
      ? INITIAL_SIZES
      : getItem(LocalStorageKeys.chart_split_sizes, INITIAL_SIZES),
  );
  useEffect(() => {
    setItem(LocalStorageKeys.chart_split_sizes, splitSizes);
  }, [splitSizes]);
  const [, setShowSplit] = useState(
    isFeatureEnabled(FeatureFlag.DATAPANEL_CLOSED_BY_DEFAULT)
      ? false
      : getItem(LocalStorageKeys.is_datapanel_open, false),
  );
  const onCollapseChange = useCallback(isOpen => {
    let splitSizes;
    if (!isOpen) {
      splitSizes = INITIAL_SIZES;
    } else {
      splitSizes = [
        100 - DEFAULT_SOUTH_PANE_HEIGHT_PERCENT,
        DEFAULT_SOUTH_PANE_HEIGHT_PERCENT,
      ];
    }
    setSplitSizes(splitSizes);
    setShowSplit(isOpen);
  }, []);
  const renderChart = useCallback(
    () => (
      <div
        css={css`
          min-height: 0;
          flex: 1;
          overflow: auto;
        `}
        ref={chartPanelRef}
      >
        {answer.result ? (
          <Col>
            <Row>
              <Col>
                <Row>
                  <Title level={3}>Answer</Title>
                </Row>
                <Row>{answer.result.answer}</Row>
              </Col>
            </Row>
            <Row>
              <Col span={12}>
                <Title level={4}>Data Visualization</Title>
              </Col>
              <Col span={12} style={{ display: 'inline-block' }}>
                <Space style={{ float: 'right', marginRight: 60 }}>
                  <Title level={4} underline>
                    Customize Visualization
                  </Title>
                </Space>
              </Col>
            </Row>
          </Col>
        ) : (
          ''
        )}
        {JSON.stringify(chartData) !== '{}' && (
          <Col>
            <Row>
              <ChartContainer
                width={Math.floor(1100)}
                height={300}
                // ownState={ownState}
                annotationData={undefined}
                chartAlert={chartAlert}
                chartStackTrace={chartStackTrace}
                chartId={chartData?.slice?.slice_id}
                chartStatus={chartStatus}
                triggerRender={triggerRender}
                force={force}
                datasource={datasource}
                errorMessage={errorMessage}
                formData={formData}
                latestQueryFormData={chartData.latestQueryFormData}
                // onQuery={chartData.onQuery}
                queriesResponse={queriesResponse}
                chartIsStale={chartIsStale}
                // setControlValue={actions.setControlValue}
                timeout={timeout}
                triggerQuery={chartData.triggerQuery}
                vizType={vizType}
              />
            </Row>
            <Row>
              <DataTablesPane
                ownState={undefined}
                queryFormData={formData}
                datasource={datasource}
                queryForce={force}
                onCollapseChange={onCollapseChange}
                chartStatus="rendered"
                // errorMessage={errorMessage}
                actions={chartData.actions}
              />
            </Row>
          </Col>
        )}
      </div>
    ),
    [
      // actions.setControlValue,
      chartData.annotationData,
      chartData.chartAlert,
      chartData.chartStackTrace,
      chartData.chartStatus,
      chartData.id,
      chartData.latestQueryFormData,
      chartData.queriesResponse,
      chartData.triggerQuery,
      chartIsStale,
      chartPanelHeight,
      chartPanelRef,
      chartPanelWidth,
      datasource,
      errorMessage,
      force,
      formData,
      // onQuery,
      ownState,
      timeout,
      triggerRender,
      vizType,
    ],
  );
  return (
    <Col
      style={{
        minHeight: '90vh',
        background: theme.colors.quotron.white,
        padding: '48px',
      }}
    >
      <Row>
        <Col span="12">
          <Row>
            <Title level={2}>Get Insights From Your Data</Title>
          </Row>
        </Col>
        {answer.result && (
          <Col span="12" style={{ display: 'inline-block' }}>
            <Row style={{ float: 'right' }}>
              <Button
                type="primary"
                icon={<ShareAltOutlined />}
                size="large"
                style={{
                  marginRight: '8px',
                  background: theme.colors.quotron.gray_white,
                  color: theme.colors.quotron.black,
                }}
              />
              <Button
                type="primary"
                icon={<SaveOutlined />}
                size="large"
                style={{
                  marginRight: '8px',
                  background: theme.colors.quotron.gray_white,
                  color: theme.colors.quotron.black,
                }}
              >
                Save Report
              </Button>
            </Row>
          </Col>
        )}
      </Row>
      <Col>
        <Row>
          <Col span={19}>
            <AutoComplete
              dropdownMatchSelectWidth={252}
              style={{ width: '100%' }}
              options={options}
              onSelect={onSelect}
              onSearch={handleSearch}
            >
              <Input
                prefix={<SearchOutlined />}
                size="large"
                placeholder="What is the sales forecast for Q2 of 2022"
                onChange={handleInputChange}
              />
            </AutoComplete>
          </Col>
          <Col span={5}>
            <Button
              style={{
                marginLeft: '8px',
                background: theme.colors.quotron.gray_white,
                color: theme.colors.quotron.black,
              }}
              size="large"
              onClick={() => handleSearch}
            >
              Search
            </Button>
          </Col>
        </Row>
      </Col>
      <Col>{renderChart()}</Col>
    </Col>
  );
};

export default ViewSearchPage;
