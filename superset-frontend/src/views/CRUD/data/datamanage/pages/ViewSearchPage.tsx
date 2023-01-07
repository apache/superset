import React, { useState, useCallback, useEffect } from 'react';
import { Row, Input, Col, Typography, Button, Layout, Menu, Modal, Image, ConfigProvider } from 'antd';
const { Sider } = Layout;
// import type { MenuProps } from 'antd';
import { SupersetClient } from '@superset-ui/core';
import { SupersetTheme, useTheme, css } from '@superset-ui/core';
import type { SelectProps } from 'antd/es/select';

import { AutoComplete } from 'antd';

import { useResizeDetector } from 'react-resize-detector';
import ChartContainer from 'src/components/Chart/ChartContainer';

const ViewSearchPage = () => {
  const theme: SupersetTheme = useTheme();
  const [open, setOpen] = useState<boolean>(false);
  const [open1, setOpen1] = useState<boolean>(false);
  const [options, setOptions] = useState<SelectProps<object>['options']>([]);
  const [answer, setAnswer] = useState<any>({});
  const [chartData, setChartData] = useState<any>({});
  const [questionLists, setQuestionLists] = useState([]);
  const [outLined, setoutLined] = useState<number>(1);
  // type MenuItem = Required<MenuProps>['items'][number];

  // function getItem(
  //   label: React.ReactNode,
  //   key: React.Key,
  // ): MenuItem {
  //   return {
  //     key,
  //     label,
  //   } as MenuItem;
  // }
  
  const data = [
    [
      { image: "line.svg", title: "Time-series Line Chart" },
      { image: "bar.svg", title: "Time-series Bar Chart" },
      { image: "scatter.svg", title: "Time-series scatter plot" },
      { image: "stepped.svg", title: "Time-series stepped plot" },
      { image: "mix.svg", title: "Mixed Time-series" }
    ],
    [
      { image: "pie.svg", title: "Pie Chart" },
      { image: "gauge.svg", title: "Gauge Chart" },
      { image: "partition.svg", title: "Partition Chart" },
      { image: "treemap.svg", title: "Treemap" },
      { image: "bignumber.svg", title: "Big Number" }
    ],
    [
      { image: "seriestable.svg", title: "Time-series Table" },
      { image: "pivottable.svg", title: "Pivot Table" },
    ],
    [
      { image: "world.svg", title: "World Map" },
      { image: "country.svg", title: "Country Map" },
    ],
  ];
  
  // const items: MenuItem[] = [
  //   getItem('Option 1', '1'),
  //   getItem('Option 2', '2'),
  //   getItem('Option 3', '3'),
  // ];

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

  const showModal = () => {
    console.log(open);
    setOpen(true);
  }

  const setTableType = (value: number) => {
    setoutLined(value)
  }

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
    <>
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
          <Button type="primary" onClick={() => setOpen(true)}> primary </Button>
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
      <Modal
        title="Choose Data Visualisation Type"
        centered
        visible={open}
        width={1000}
        footer={null}
        onCancel={() => setOpen(false)}
      >
        <Layout
          style={{
            minHeight: "100vh"
          }}
        >
          <Sider theme="light" className="site-layout">
            <Menu
              theme="light"
              mode="inline"
              defaultSelectedKeys={["1"]}
              
            >
              <Menu.Item key={1} className={`${outLined === 1 ? 'ant-menu-item-selected' : ''}`} onClick={() => setTableType(1)}>Time-series charts</Menu.Item>
              <Menu.Item key={2} className={`${outLined === 2 ? 'ant-menu-item-selected' : ''}`} onClick={() => setTableType(2)}>Traditional charts</Menu.Item>
              <Menu.Item key={3} className={`${outLined === 3 ? 'ant-menu-item-selected' : ''}`} onClick={() => setTableType(3)}>Tables</Menu.Item>
              <Menu.Item key={4} className={`${outLined === 4 ? 'ant-menu-item-selected' : ''}`} onClick={() => setTableType(4)}>Geo Maps</Menu.Item>
            </Menu>
          </Sider>
          <Layout className="site-layout">
            <Row>
            {
              data[outLined-1].map(function(item){
                  return (<Col span={8}>
                  <div>
                    <Image
                      width={230}
                      height={230}
                      preview={false}
                      src={`../../../../../static/assets/images/customizethumb/${item.image}`}
                    />
                    <p>{item.title}</p>
                    <div>
                      <Button style={{ margin: "20px", background:"#7D3AD3", color: "#000000"}}>Select</Button>
                      <Button onClick={() => setOpen1(true)}>customize</Button>
                    </div>
                  </div>
              </Col>)})}
            </Row>
          </Layout>
        </Layout>
      </Modal>
      <Modal
        visible={open1}
        title="Title"
        // onCancel={handleCancel}
        footer={[
          <Button key="back" type="primary" onClick={() => setOpen1(false)}>
            Return
          </Button>
        ]}
      >
        <Row>
          <Col span={8}>
            <Row>
              <Typography>Chart Title</Typography>
              <Input placeholder="Write Here" />
            </Row>
            <Row>
              <Typography>Chart Title</Typography>
              <Input placeholder="Write Here" />
            </Row>
            <Row>
              <Typography>Chart Title</Typography>
              <Input placeholder="Write Here" />
            </Row>
          </Col>
          <Col span={8}>
            <Row>
              <Typography>Chart Title</Typography>
            </Row>
            <Row>
              <Typography>Chart Title</Typography>
            </Row>
          </Col>
          <Col span={8}></Col>
        </Row>
      </Modal>
  </>
  );
};

export default ViewSearchPage;
