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

import { bigNumberFormData } from '../../../../superset-ui-core/test/chart/fixtures/formData';

import VerifyCORS, {
  Props as VerifyCORSProps,
} from '../../shared/components/VerifyCORS';
import Expandable from '../../shared/components/Expandable';

const REQUEST_METHODS = ['GET', 'POST'];
const ENDPOINTS = {
  '(Empty - verify auth only)': '/',
  '/api/v1/chart/data': '/api/v1/chart/data',
};

export default {
  title: 'Core Packages/@superset-ui-connection',
  decorators: [
    // withKnobs({
    //   escapeHTML: false,
    // }),
  ],
};

export const ConfigureCORS = ({
  host,
  selectEndpoint,
  customEndpoint,
  methodOption,
  postPayloadContents,
}: {
  host: string;
  selectEndpoint: string;
  customEndpoint: string;
  methodOption: string;
  postPayloadContents: string;
}) => {
  const endpoint = customEndpoint || selectEndpoint;
  const method = endpoint ? methodOption : undefined;
  const postPayload =
    endpoint && method === 'POST' ? postPayloadContents : undefined;

  return (
    <div style={{ margin: 16 }}>
      <VerifyCORS
        host={host}
        endpoint={endpoint}
        method={method as VerifyCORSProps['method']}
        postPayload={`${postPayload}`}
      >
        {({ payload }) => (
          <>
            <div className="alert alert-success">
              Success! Update controls below to try again
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
ConfigureCORS.args = {
  host: 'localhost:8088',
  selectEndpoint: '/api/v1/chart/data',
  customEndpoint: '',
  methodOption: 'POST', // TODO disable when custonEndpoint and selectEndpoint are empty
  postPayloadContents: JSON.stringify({ form_data: bigNumberFormData }),
};
ConfigureCORS.argTypes = {
  host: {
    control: 'text',
    description: 'Set Superset App host for CORS request',
  },
  selectEndpoint: {
    control: {
      type: 'select',
      options: Object.keys(ENDPOINTS),
    },
    mapping: ENDPOINTS,
    description: 'Select an endpoint',
  },
  customEndpoint: {
    control: 'text',
    description: 'Custom Endpoint (override above)',
  },
  methodOption: {
    control: 'select',
    options: REQUEST_METHODS,
    description: 'Select a request method',
  },
  postPayloadContents: {
    control: 'text',
    description: 'Set POST payload contents',
  },
};
ConfigureCORS.storyName = 'Verify CORS';
