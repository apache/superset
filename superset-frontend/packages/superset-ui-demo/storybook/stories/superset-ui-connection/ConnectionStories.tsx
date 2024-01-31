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
import React from 'react';
// import { bigNumberFormData } from '../../../../superset-ui-core/test/chart/fixtures/formData';
import VerifyCORS, { Props as VerifyCORSProps } from '../../shared/components/VerifyCORS';
import Expandable from '../../shared/components/Expandable';

const REQUEST_METHODS = ['GET', 'POST'];
const ENDPOINTS = {
  '(Empty - verify auth only)': '/',
  '/api/v1/chart/data': '/api/v1/chart/data',
};

export default {
  title: 'Core Packages/@superset-ui-connection',
  argTypes: {
    host: { control: 'text', defaultValue: 'localhost:8088' },
    selectEndpoint: { control: 'select', options: Object.keys(ENDPOINTS), defaultValue: '' },
    customEndpoint: { control: 'text', defaultValue: '' },
    method: { control: 'select', options: REQUEST_METHODS },
    postPayload: { control: 'text' },
  },
};

const ConfigureCORS = ({
  host,
  selectEndpoint,
  customEndpoint,
  method,
  postPayload,
}) => {
  const endpoint = customEndpoint || selectEndpoint;
  const postPayloadProcessed = endpoint && method === 'POST' ? postPayload : undefined;

  return (
    <div style={{ margin: 16 }}>
      <VerifyCORS
        host={host}
        endpoint={endpoint}
        method={method as VerifyCORSProps['method']}
        postPayload={`${postPayloadProcessed}`}
      >
        {({ payload }) => (
          <>
            <div className="alert alert-success">
              Success! Update knobs below to try again
            </div>
            <br />
            <Expandable expandableWhat="payload">
              <br />
              <pre style={{ fontSize: 11 }}>
                {JSON.stringify(payload, null, 2)}
              </pre>
            </Expandable>
          </>
        )}
      </VerifyCORS>
    </div>
  );
};

export const ConfigureCORSStory = ConfigureCORS.bind({});
