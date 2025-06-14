/*
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

import {
  SuperChart,
  ChartDataProvider,
  SupersetClient,
} from '@superset-ui/core';
import Expandable from './Expandable';
import VerifyCORS, { renderError } from './VerifyCORS';

export default function createQueryStory({
  choices,
}: {
  choices: {
    [key: string]: {
      chartType: string;
      formData: {
        [key: string]: any;
      };
    };
  };
}) {
  const keys = Object.keys(choices);
  const story = (
    host: string,
    mode: string | number,
    width: number,
    height: number,
    formData: any,
  ) => {
    const { chartType } = choices[mode];

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
                        queriesData={payload.queriesData}
                      />
                      <br />
                      <Expandable expandableWhat="payload">
                        <pre style={{ fontSize: 11 }}>
                          {JSON.stringify(payload, null, 2)}
                        </pre>
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
  };
  story.args = {
    host: 'localhost:8088',
    mode: keys[0],
    width: '400',
    height: '400',
    formData: JSON.stringify(choices[keys[0]].formData, null, 2),
  };
  story.argTypes = {
    host: {
      control: 'text',
      description: 'Superset App host for CORS request',
    },
    mode: { control: 'select', options: keys, description: 'Choose mode' },
    width: { control: 'text', description: 'Vis width' },
    height: { control: 'text', description: 'Vis height' },
    formData: { control: 'text', description: 'Override formData' },
  };
  return story;
}
