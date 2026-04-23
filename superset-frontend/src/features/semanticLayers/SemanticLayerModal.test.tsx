/**
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
import { SupersetClient } from '@superset-ui/core';
import { render, waitFor } from 'spec/helpers/testing-library';

import SemanticLayerModal from './SemanticLayerModal';

let mockJsonFormsChangeTriggered = false;

jest.mock('@jsonforms/react', () => ({
  ...jest.requireActual('@jsonforms/react'),
  JsonForms: ({ onChange }: { onChange: (value: unknown) => void }) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    if (!mockJsonFormsChangeTriggered) {
      mockJsonFormsChangeTriggered = true;
      onChange({
        data: { warehouse: 'wh1' },
        errors: [],
      });
    }
    return null;
  },
}));

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  SupersetClient: {
    ...jest.requireActual('@superset-ui/core').SupersetClient,
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
  },
  getClientErrorObject: jest.fn(() => Promise.resolve({ error: '' })),
}));

const mockedGet = SupersetClient.get as jest.Mock;
const mockedPost = SupersetClient.post as jest.Mock;

const props = {
  show: true,
  onHide: jest.fn(),
  addDangerToast: jest.fn(),
  addSuccessToast: jest.fn(),
  semanticLayerUuid: '11111111-1111-1111-1111-111111111111',
};

beforeEach(() => {
  mockJsonFormsChangeTriggered = false;
  jest.useFakeTimers();
  mockedGet.mockReset();
  mockedPost.mockReset();

  mockedGet
    .mockResolvedValueOnce({
      json: {
        result: [{ id: 'snowflake', name: 'Snowflake', description: '' }],
      },
    })
    .mockResolvedValueOnce({
      json: {
        result: {
          name: 'Layer 1',
          type: 'snowflake',
          configuration: { warehouse: 'wh0' },
        },
      },
    });

  mockedPost.mockResolvedValue({
    json: {
      result: {
        type: 'object',
        properties: {
          warehouse: {
            type: 'string',
            'x-dynamic': true,
            'x-dependsOn': ['warehouse'],
          },
        },
      },
    },
  });
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

test('posts configuration schema refresh after debounce', async () => {
  render(<SemanticLayerModal {...props} />);

  await waitFor(() => {
    expect(mockedPost).toHaveBeenCalledWith({
      endpoint: '/api/v1/semantic_layer/schema/configuration',
      jsonPayload: { type: 'snowflake' },
    });
  });

  jest.advanceTimersByTime(501);

  await waitFor(() => {
    expect(mockedPost).toHaveBeenCalledWith({
      endpoint: '/api/v1/semantic_layer/schema/configuration',
      jsonPayload: {
        type: 'snowflake',
        configuration: { warehouse: 'wh1' },
      },
    });
  });
});
