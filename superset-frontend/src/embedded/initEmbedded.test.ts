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

jest.mock('src/utils/getBootstrapData', () => ({
  __esModule: true,
  default: jest.fn(),
}));

beforeEach(() => {
  jest.resetModules();
});

test('initEmbedded exports bootstrapData from getBootstrapData', async () => {
  const mockBootstrapData = {
    common: {
      feature_flags: {
        EMBEDDED_SUPERSET: true,
      },
    },
  };

  const { default: getBootstrapData } = jest.requireMock(
    'src/utils/getBootstrapData',
  );
  getBootstrapData.mockReturnValue(mockBootstrapData);

  const { bootstrapData } = await import('./initEmbedded');

  expect(getBootstrapData).toHaveBeenCalledTimes(1);
  expect(bootstrapData).toBe(mockBootstrapData);
});
