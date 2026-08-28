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

import {
  getDatasetCertification,
  setDatasetCertification,
} from '../datasetCertification';

test('reads dataset certification from Extra JSON', () => {
  expect(
    getDatasetCertification(
      JSON.stringify({
        certification: {
          certified_by: 'Data Platform Team',
          details: 'Source of truth',
        },
      }),
    ),
  ).toEqual({
    certified_by: 'Data Platform Team',
    certification_details: 'Source of truth',
  });
});

test('writes dataset certification without discarding other Extra metadata', () => {
  const result = setDatasetCertification(
    JSON.stringify({
      custom_key: { enabled: true },
      warning_markdown: 'Use only finalized records',
    }),
    {
      certified_by: 'E2E Team',
      certification_details: 'Reviewed for production',
    },
  );

  expect(JSON.parse(result)).toEqual({
    custom_key: { enabled: true },
    warning_markdown: 'Use only finalized records',
    certification: {
      certified_by: 'E2E Team',
      details: 'Reviewed for production',
    },
  });
});

test('clearing dataset certification preserves other Extra metadata', () => {
  const result = setDatasetCertification(
    JSON.stringify({
      certification: {
        certified_by: 'Data Platform Team',
        details: 'Source of truth',
      },
      warning_markdown: 'Use only finalized records',
    }),
    {},
  );

  expect(JSON.parse(result)).toEqual({
    warning_markdown: 'Use only finalized records',
  });
});

test('editing certification does not overwrite malformed Extra JSON', () => {
  expect(
    setDatasetCertification('{"custom_key":', {
      certified_by: 'Data Platform Team',
    }),
  ).toBe('{"custom_key":');
});
