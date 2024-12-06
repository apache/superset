import { Card, Col, Drawer, Row, Spin } from 'antd';
// eslint-disable-next-line import/no-extraneous-dependencies
import { marked } from 'marked';
import genAiIcon from './../../assets/images/genai.png';
import axios from 'axios';
import { useEffect, useState } from 'react';
import wandIcon from './../../assets/images/wand.png';

interface HTMLRendererProps {
  htmlContent: string; // HTML string to render
}

const HTMLRenderer: React.FC<HTMLRendererProps> = ({ htmlContent }) => (
  // eslint-disable-next-line react/no-danger
  <div dangerouslySetInnerHTML={{ __html: htmlContent }} />
);

const ChartSummaryDrawer = (props: any) => {
  const { onClose, visible, title, charts, dashboardInfo } = props;

  const chartSummary: any = [];
  const [chartSummaryLoader, setChartSummaryLoader] = useState(true);
  const [finalResult, setFinalResult] = useState([]);

  useEffect(() => {
    if (visible) {
      let counter = 0;
      const sendRequest = async (data: any, formdata: any) => {
        const { metric, viz_type, groupby, x_axis } = formdata;
        try {
          const response = await axios.post(
            'https://api.development.shipmnts.com/turingbot/ai-chart-summarize',
            { data, metric, viz_type, groupby, x_axis },
            {
              headers: {
                'Content-Type': 'application/json',
              },
            },
          );

          chartSummary.push(response.data.summary);
          if (counter === chartSummary.length) {
            setFinalResult(chartSummary);
            setChartSummaryLoader(false);
          }
        } catch (error) {
          console.error('Error:', error);
        }
      };
      (Object.values(charts) || []).forEach((value: any) => {
        if (value.chartStatus === 'rendered' && !!value?.queriesResponse) {
          counter += 1;
          sendRequest(value?.queriesResponse[0].data, value.form_data);
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [charts, visible]);

  return (
    <>
      <Drawer
        title={
          <>
            <div style={{ display: 'inline-block', cursor: 'pointer' }}>
              <img
                src={genAiIcon}
                alt="Wand Icon"
                style={{ width: '19.5px', height: '19.5px' }}
              />
              <b> Alex Insights on Chart:</b>
            </div>
          </>
        }
        placement="right"
        onClose={onClose}
        visible={visible}
        width="40%"
      >
        {chartSummaryLoader && <Spin />}

        {!chartSummaryLoader && (
          <div>
            {finalResult.map((val, index) => (
              <>
                <Card hoverable title={title || dashboardInfo[index]}>
                  <HTMLRenderer key={index} htmlContent={marked(val)} />
                </Card>
                <br />
              </>
            ))}
          </div>
        )}
      </Drawer>
    </>
  );
};

export default ChartSummaryDrawer;
