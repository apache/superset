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
import Handlebars from 'handlebars';

// Importing the viewer registers the dayjs-backed `formatDate` override (#32960).
// The end-to-end behavior (the bundling/minification regression) is covered by a
// Playwright spec; these unit tests guard the helper's edge cases, which run fine
// under Jest's Node environment without a browser.
import '../../src/components/Handlebars/HandlebarsViewer';

// Handlebars passes its options object as the trailing argument, so callers that
// omit the optional locale still get a non-string final arg. Mimic that here.
const options = {} as unknown as string;

const formatDate = (
  format: string,
  date: unknown,
  locale: string = options,
): string =>
  (Handlebars.helpers.formatDate as (...args: unknown[]) => string)(
    format,
    date,
    locale,
  );

test('formats a valid date string with the supplied format', () => {
  expect(formatDate('DD.MM.YYYY', '2024-06-14')).toBe('14.06.2024');
});

test('renders "Invalid date" for an unparseable date string', () => {
  expect(formatDate('DD.MM.YYYY', 'not-a-date')).toBe('Invalid date');
});

test('coerces a non-string format to dayjs default output without throwing', () => {
  // The helper guards against a non-string format by passing '' to dayjs,
  // which renders its default ISO 8601 representation rather than throwing.
  expect(() =>
    formatDate(undefined as unknown as string, '2024-06-14'),
  ).not.toThrow();
  expect(formatDate(undefined as unknown as string, '2024-06-14')).toContain(
    '2024-06-14',
  );
});

test('preserves the epoch-0 timestamp instead of falling back to now', () => {
  // 1970-01-01 in UTC, which is 1969 or 1970 locally depending on tz offset;
  // the point is it is NOT coerced to the current date.
  expect(formatDate('YYYY', 0)).toMatch(/^(1969|1970)$/);
});

test('silently falls back to English for a locale that is not loaded', () => {
  // extendedDayjs only loads the `en` locale, so a non-English locale no-ops.
  expect(formatDate('MMMM', '2024-06-14', 'fr')).toBe('June');
});
