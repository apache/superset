/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more agreed to in writing, software
 * distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import normalizeTimestamp from '../../../src/time-format/utils/normalizeTimestamp';

test('normalizeTimestamp should normalize typical timestamps', () => {
  expect(normalizeTimestamp('2023-03-11 08:26:52.695 UTC')).toEqual(
    '2023-03-11T08:26:52.695Z',
  );
  expect(normalizeTimestamp('2023-03-11 08:26:52.695 Europe/Helsinki')).toEqual(
    '2023-03-11T08:26:52.695Z',
  );
  expect(normalizeTimestamp('2023-03-11T08:26:52.695 UTC')).toEqual(
    '2023-03-11T08:26:52.695Z',
  );
  expect(normalizeTimestamp('2023-03-11T08:26:52.695')).toEqual(
    '2023-03-11T08:26:52.695Z',
  );
  expect(normalizeTimestamp('2023-03-11 08:26:52')).toEqual(
    '2023-03-11T08:26:52Z',
  );
});

test('normalizeTimestamp should return unmatched timestamps as-is', () => {
  expect(normalizeTimestamp('abcd')).toEqual('abcd');
  expect(normalizeTimestamp('03/11/2023')).toEqual('03/11/2023');
});

test('normalizeTimestamp should not rewrite timestamps with an explicit UTC offset', () => {
  expect(normalizeTimestamp('2026-01-15T12:30:00+03:30')).toEqual(
    '2026-01-15T12:30:00+03:30',
  );
  expect(normalizeTimestamp('2026-01-15T12:30:00Z')).toEqual(
    '2026-01-15T12:30:00Z',
  );
  expect(normalizeTimestamp('2026-01-15T12:30:00-05:00')).toEqual(
    '2026-01-15T12:30:00-05:00',
  );
  expect(normalizeTimestamp('2026-01-15 12:30:00+0330')).toEqual(
    '2026-01-15 12:30:00+0330',
  );
});
