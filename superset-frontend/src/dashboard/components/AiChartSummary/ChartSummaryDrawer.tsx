import React, { useEffect, useState } from 'react';
import { Card, Drawer, Spin } from 'antd';
// eslint-disable-next-line import/no-extraneous-dependencies
import { marked } from 'marked';
import genAiIcon from './../../../assets/images/genai.png';
import axios from 'axios';

interface HTMLRendererProps {
  htmlContent: string; // HTML string to render
}

const HTMLRenderer: React.FC<HTMLRendererProps> = ({ htmlContent }: any) => (
  // eslint-disable-next-line react/no-danger
  <div dangerouslySetInnerHTML={{ __html: htmlContent }} />
);

const ChartSummaryDrawer = (props: any) => {
  const { onClose, visible, title, charts, dashboardInfo } = props;

  const [drawerWidth, setDrawerWidth] = useState<string | number>('40%');
  const [results, setResults] = useState<(string | null)[]>([]);
  const [loaders, setLoaders] = useState<boolean[]>([]);

  useEffect(() => {
    const updateDrawerWidth = () => {
      setDrawerWidth(window.innerWidth < 980 ? '100%' : '40%');
    };

    // Initial check
    updateDrawerWidth();

    // Event listener for window resize
    window.addEventListener('resize', updateDrawerWidth);

    return () => {
      window.removeEventListener('resize', updateDrawerWidth);
    };
  }, []);

  useEffect(() => {
    if (visible) {
      const chartEntries = Object.values(charts) || [];
      const initialResults = Array(chartEntries.length).fill(null);
      const initialLoaders = Array(chartEntries.length).fill(true);

      setResults(initialResults);
      setLoaders(initialLoaders);

      chartEntries.forEach((chart: any, index: number) => {
        if (chart.chartStatus === 'rendered' && chart?.queriesResponse) {
          const { data, form_data } = chart.queriesResponse[0];
          const { metric, viz_type, groupby, x_axis } = form_data;

          axios
            .post(
              'https://api.development.shipmnts.com/turingbot/ai-chart-summarize',
              { data, metric, viz_type, groupby, x_axis },
              { headers: { 'Content-Type': 'application/json' } },
            )
            .then((response: any) => {
              const newResults = [...results];
              newResults[index] = response.data.summary;
              setResults(newResults);

              const newLoaders = [...loaders];
              newLoaders[index] = false;
              setLoaders(newLoaders);
            })
            .catch((error: any) => {
              console.error(`Error loading chart ${index}:`, error);

              const newLoaders = [...loaders];
              newLoaders[index] = false;
              setLoaders(newLoaders);
            });
        }
      });
    }
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
        width={drawerWidth}
      >
        <div>
          {(Object.values(charts) || []).map((chart: any, index: number) => (
            <React.Fragment key={index}>
              {loaders[index] ? (
                <Spin />
              ) : (
                <Card hoverable title={title || dashboardInfo[index]}>
                  <HTMLRenderer htmlContent={marked(results[index] || '')} />
                </Card>
              )}
              <br />
            </React.Fragment>
          ))}
        </div>
      </Drawer>
    </>
  );
};

export default ChartSummaryDrawer;
