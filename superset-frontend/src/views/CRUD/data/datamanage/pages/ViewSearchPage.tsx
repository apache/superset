import React, { useState, useCallback, useEffect } from 'react';
import { Row, Input, Col, Typography } from 'antd';
import { SupersetClient } from '@superset-ui/core';
import { SupersetTheme, useTheme, css } from '@superset-ui/core';
import type { SelectProps } from 'antd/es/select';

import { AutoComplete } from 'antd';

import { useResizeDetector } from 'react-resize-detector';
import ChartContainer from 'src/components/Chart/ChartContainer';

const ViewSearchPage = () => {
  const theme: SupersetTheme = useTheme();
  const [options, setOptions] = useState<SelectProps<object>['options']>([]);
  const [answer, setAnswer] = useState<any>({});
  const [chartData, setChartData] = useState<any>({});
  const [questionLists, setQuestionLists] = useState([]);
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
      const category: string = `${value.question}`;
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
    }
  }, [answer]);
  const [queriesResponse, setQueriesResponse] = useState<any>({});
  const handleChart = (slice_id: number) => {
    SupersetClient.get({
      endpoint: `/api/v1/explore?slice_id=${slice_id}`,
    }).then(async ({ json = {} }) => {
      console.log(JSON.parse(json.result.slice.query_context));
      console.log(json.result);
      setChartData(json.result);
    });
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
  const {
    width: chartPanelWidth,
    height: chartPanelHeight,
    ref: chartPanelRef,
  } = useResizeDetector({
    refreshMode: 'debounce',
    refreshRate: 300,
  });
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
        {JSON.stringify(chartData) !== '{}' && (
          <ChartContainer
            width={Math.floor(1000)}
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
            onQuery={chartData.onQuery}
            queriesResponse={queriesResponse}
            chartIsStale={chartIsStale}
            // setControlValue={actions.setControlValue}
            timeout={timeout}
            triggerQuery={chartData.triggerQuery}
            vizType={vizType}
          />
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
        <Col>
          <Title>Get Insights From Your Data</Title>
        </Col>
      </Row>
      <Col>
        <Row>
          <AutoComplete
            dropdownMatchSelectWidth={252}
            style={{ width: 300 }}
            options={options}
            onSelect={onSelect}
            onSearch={handleSearch}
          >
            <Input.Search
              size="large"
              placeholder="input here"
              onChange={handleInputChange}
              enterButton
            />
          </AutoComplete>
        </Row>
      </Col>
      <Col>{renderChart()}</Col>
    </Col>
  );
};

export default ViewSearchPage;
