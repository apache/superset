import React from 'react';
import { text, select } from '@storybook/addon-knobs';
import { SuperChart, ChartDataProvider } from '@superset-ui/chart';
import { SupersetClient } from '@superset-ui/connection';
import Expandable from './Expandable';
import VerifyCORS, { renderError } from './VerifyCORS';

export default function createQueryStory({
  choices,
  storyName = 'Queries',
  storyPath = '',
}: {
  choices: {
    [key: string]: {
      chartType: string;
      formData: {
        [key: string]: any;
      };
    };
  };
  storyName: string;
  storyPath: string;
}) {
  const keys = Object.keys(choices);

  return {
    renderStory: () => {
      const host = text('Set Superset App host for CORS request', 'localhost:8088');
      const mode = select('Choose mode:', keys, keys[0]);
      const { formData: presetFormData, chartType } = choices[mode];
      const width = text('Vis width', '400');
      const height = text('Vis height', '400');
      const formData = text('Override formData', JSON.stringify(presetFormData, null, 2));

      return (
        <div style={{ margin: 16 }}>
          <VerifyCORS host={host}>
            {() => (
              <ChartDataProvider
                client={SupersetClient}
                formData={JSON.parse(formData.replace(/&quot;/g, '"'))}
              >
                {({ loading, payload, error }) => {
                  if (loading) return <div>Loading!</div>;

                  if (error) return renderError(error);

                  if (payload)
                    return (
                      <>
                        <SuperChart
                          chartType={chartType}
                          width={width}
                          height={height}
                          formData={payload.formData}
                          // @TODO fix typing
                          // all vis's now expect objects but api/v1/ returns an array
                          payload={
                            Array.isArray(payload.queryData)
                              ? payload.queryData[0]
                              : payload.queryData
                          }
                        />
                        <br />
                        <Expandable expandableWhat="payload">
                          <pre style={{ fontSize: 11 }}>{JSON.stringify(payload, null, 2)}</pre>
                        </Expandable>
                      </>
                    );

                  return null;
                }}
              </ChartDataProvider>
            )}
          </VerifyCORS>
        </div>
      );
    },
    storyName,
    storyPath,
  };
}
