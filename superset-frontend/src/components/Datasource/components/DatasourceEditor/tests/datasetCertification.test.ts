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
  isDatasetExtraValid,
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

  expect(JSON.parse(result ?? '')).toEqual({
    custom_key: { enabled: true },
    warning_markdown: 'Use only finalized records',
    certification: {
      certified_by: 'E2E Team',
      details: 'Reviewed for production',
    },
  });
});

test('writes certification details without requiring a certifier', () => {
  const result = setDatasetCertification('{}', {
    certification_details: 'Reviewed for production',
  });

  expect(JSON.parse(result ?? '')).toEqual({
    certification: { details: 'Reviewed for production' },
  });
});

test('editing certification preserves unknown certification metadata', () => {
  const result = setDatasetCertification(
    JSON.stringify({
      certification: {
        certified_by: 'Data Platform Team',
        details: 'Source of truth',
        expires_at: '2030-01-01',
      },
    }),
    {
      certified_by: 'E2E Team',
      certification_details: 'Reviewed for production',
    },
  );

  expect(JSON.parse(result ?? '')).toEqual({
    certification: {
      certified_by: 'E2E Team',
      details: 'Reviewed for production',
      expires_at: '2030-01-01',
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
    { certified_by: '', certification_details: '' },
  );

  expect(JSON.parse(result ?? '')).toEqual({
    warning_markdown: 'Use only finalized records',
  });
});

test('clearing certification preserves unknown certification metadata', () => {
  const result = setDatasetCertification(
    JSON.stringify({
      certification: {
        certified_by: 'Data Platform Team',
        details: 'Source of truth',
        expires_at: '2030-01-01',
      },
    }),
    { certified_by: '', certification_details: '' },
  );

  expect(JSON.parse(result ?? '')).toEqual({
    certification: { expires_at: '2030-01-01' },
  });
});

test('an unchanged certification leaves Extra formatting untouched', () => {
  const extra = '{\n    "certification": { "certified_by": "Data Team" }\n}';

  expect(setDatasetCertification(extra, { certified_by: 'Data Team' })).toBe(
    extra,
  );
  expect(
    setDatasetCertification(undefined, {
      certified_by: '',
      certification_details: '',
    }),
  ).toBeUndefined();
});

test('handles non-object Extra and certification values', () => {
  expect(getDatasetCertification('[]')).toEqual({});
  expect(getDatasetCertification('{"certification":true}')).toEqual({});
  expect(
    setDatasetCertification('{"certification":true}', {
      certified_by: 'Data Team',
    }),
  ).toBe('{"certification":{"certified_by":"Data Team"}}');
});

test('identifies malformed and non-object Extra JSON', () => {
  expect(isDatasetExtraValid()).toBe(true);
  expect(isDatasetExtraValid('{}')).toBe(true);
  expect(isDatasetExtraValid('{"custom_key":')).toBe(false);
  expect(isDatasetExtraValid('[]')).toBe(false);
});

test('editing certification does not overwrite malformed Extra JSON', () => {
  expect(
    setDatasetCertification('{"custom_key":', {
      certified_by: 'Data Platform Team',
    }),
  ).toBe('{"custom_key":');
});
