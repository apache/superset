import React, { useState, useCallback, useEffect } from 'react';
import {
  Row,
  Input,
  Col,
  Typography,
  Space,
  Button,
  AutoComplete,
  Modal,
  Layout,
  Menu,
  Image,
} from 'antd';
import {
  ShareAltOutlined,
  SaveOutlined,
  SearchOutlined,
  ArrowLeftOutlined,
} from '@ant-design/icons';
import {
  SupersetClient,
  SupersetTheme,
  useTheme,
  css,
  getCategoricalSchemeRegistry,
} from '@superset-ui/core';
import type { SelectProps } from 'antd/es/select';

import { useResizeDetector } from 'react-resize-detector';
import ChartContainer from 'src/components/Chart/ChartContainer';
import ColorSchemeControl, {
  ColorSchemes,
} from 'src/explore/components/controls/ColorSchemeControl/index';
import { DataTablesPane } from 'src/explore/components/DataTablesPane/index';
import { FeatureFlag, isFeatureEnabled } from 'src/featureFlags';
import {
  getItem,
  setItem,
  LocalStorageKeys,
} from 'src/utils/localStorageHelpers';

const categoricalSchemeRegistry = getCategoricalSchemeRegistry();
const { Sider } = Layout;
const INITIAL_SIZES: [number, number] = [100, 0];
const ViewSearchPage = () => {
  const theme: SupersetTheme = useTheme();
  const [options, setOptions] = useState<SelectProps<object>['options']>([]);
  const [answer, setAnswer] = useState<any>({});
  const [chartData, setChartData] = useState<any>({});
  const [questionLists, setQuestionLists] = useState([]);
  const [queriesResponse, setQueriesResponse] = useState<any>([]);
  const [selectVModal, setSelectVModal] = useState<boolean>(false);
  const [custoModal, setCustoModal] = useState<boolean>(false);
  const [outLined, setoutLined] = useState<number>(1);
  const [previewState, setPreviewState] = useState<boolean>(false);
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
  const setTableType = (value: number) => {
    setoutLined(value);
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
  const defaultProps = {
    hasCustomLabelColors: false,
    label: 'Color scheme',
    defaultScheme: categoricalSchemeRegistry.getDefaultKey(),
    labelMargin: 0,
    name: 'color',
    value: 'supersetDefault',
    onChange: () => setPreviewState(true),
    clearable: true,
    choices: () => categoricalSchemeRegistry.keys().map(s => [s, s]),
    schemes: () => categoricalSchemeRegistry.getMap() as ColorSchemes,
    isLinear: false,
  };

  const customizeRowStyle = {
    marginLeft: 20,
    marginBlock: 30,
  };
  const TempData = [
    [
      { image: 'line.svg', title: 'Time-series Line Chart' },
      { image: 'bar.svg', title: 'Time-series Bar Chart' },
      { image: 'scatter.svg', title: 'Time-series scatter plot' },
      { image: 'stepped.svg', title: 'Time-series stepped plot' },
      { image: 'mix.svg', title: 'Mixed Time-series' },
    ],
    [
      { image: 'pie.svg', title: 'Pie Chart' },
      { image: 'gauge.svg', title: 'Gauge Chart' },
      { image: 'partition.svg', title: 'Partition Chart' },
      { image: 'treemap.svg', title: 'Treemap' },
      { image: 'bignumber.svg', title: 'Big Number' },
    ],
    [
      { image: 'seriestable.svg', title: 'Time-series Table' },
      { image: 'pivottable.svg', title: 'Pivot Table' },
    ],
    [
      { image: 'world.svg', title: 'World Map' },
      { image: 'country.svg', title: 'Country Map' },
    ],
  ];
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
              <Col
                span={12}
                style={{ display: 'inline-block' }}
                onClick={() => setSelectVModal(true)}
              >
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
    <>
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
      <Modal
        title="Choose Data Visualisation Type"
        centered
        visible={selectVModal}
        width={1200}
        footer={null}
        onCancel={() => setSelectVModal(false)}
        bodyStyle={{ padding: '0px' }}
      >
        <Layout
          style={{
            minHeight: '90vh',
          }}
        >
          <Sider
            style={{ background: theme.colors.quotron.gray_white }}
            className="site-layout"
          >
            <Menu
              style={{ background: theme.colors.quotron.gray_white }}
              mode="inline"
              defaultSelectedKeys={['1']}
            >
              <Menu.Item
                key={1}
                className={`${outLined === 1 ? 'ant-menu-item-selected' : ''}`}
                onClick={() => setTableType(1)}
              >
                Time-series charts
              </Menu.Item>
              <Menu.Item
                key={2}
                className={`${outLined === 2 ? 'ant-menu-item-selected' : ''}`}
                onClick={() => setTableType(2)}
              >
                Traditional charts
              </Menu.Item>
              <Menu.Item
                key={3}
                className={`${outLined === 3 ? 'ant-menu-item-selected' : ''}`}
                onClick={() => setTableType(3)}
              >
                Tables
              </Menu.Item>
              <Menu.Item
                key={4}
                className={`${outLined === 4 ? 'ant-menu-item-selected' : ''}`}
                onClick={() => setTableType(4)}
              >
                Geo Maps
              </Menu.Item>
            </Menu>
          </Sider>
          <Layout
            className="site-layout"
            style={{ background: theme.colors.quotron.white, paddingLeft: 10 }}
          >
            <Row>
              {TempData[outLined - 1].map(function (item) {
                return (
                  <Col span={8} style={{ marginBottom: 10 }}>
                    <div style={{ paddingRight: 30 }}>
                      <Image
                        style={{ width: '120%', height: 'auto' }}
                        preview={false}
                        src={`../../../../../static/assets/images/customizethumb/${item.image}`}
                      />
                      <p>{item.title}</p>
                      <Row justify="space-between">
                        <Button
                          style={{
                            background: theme.colors.error.light1,
                            color: theme.colors.quotron.white,
                          }}
                        >
                          Select
                        </Button>
                        <Button onClick={() => setCustoModal(true)}>
                          customize
                        </Button>
                      </Row>
                    </div>
                  </Col>
                );
              })}
            </Row>
          </Layout>
        </Layout>
      </Modal>
      <Modal
        visible={custoModal}
        title={
          <>
            <ArrowLeftOutlined
              onClick={() => {
                setCustoModal(false);
                setPreviewState(false);
              }}
            />
            &nbsp;&nbsp;&nbsp;Customize Chart
          </>
        }
        centered
        width={1200}
        bodyStyle={{ padding: '0px' }}
        closable={false}
        onCancel={() => setCustoModal(false)}
        footer={null}
      >
        <Row style={{ height: '90vh' }} justify="space-between">
          <Col span={8}>
            <Row style={customizeRowStyle}>
              <Title level={4}>Chart Title</Title>
              <Input placeholder="Write Here" size="large" />
            </Row>
            <Row style={customizeRowStyle}>
              <Title level={4}>Label of the X-axis:</Title>
              <Input placeholder="Write Here" size="large" />
            </Row>
            <Row style={customizeRowStyle}>
              <Title level={4}>Theme colors</Title>
              <ColorSchemeControl {...defaultProps} />
            </Row>
            <Row style={{ marginTop: 350, marginLeft: 20 }}>
              <Button type="primary" onClick={() => setCustoModal(false)}>
                Save
              </Button>
            </Row>
          </Col>
          <Col span={8}>
            <Row style={customizeRowStyle}>
              <Title level={4}>Label of the legends of the charts:</Title>
              <Input placeholder="Write Here" size="large" />
            </Row>
            <Row style={customizeRowStyle}>
              <Title level={4}>Label of the Y-axis:</Title>
              <Input placeholder="Write Here" size="large" />
            </Row>
          </Col>
          <Col span={8} style={{ padding: 20 }}>
            <Layout
              style={{
                background: theme.colors.quotron.gray_white,
                height: '85vh',
              }}
            >
              Preview
              {previewState && (
                <Image
                  style={{ width: '100%', height: 'auto', marginTop: 200 }}
                  preview={false}
                  src="../../../../../static/assets/images/customizethumb/pie.svg"
                />
              )}
            </Layout>
          </Col>
        </Row>
      </Modal>
    </>
  );
};

export default ViewSearchPage;
