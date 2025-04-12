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
import { cleanup } from 'spec/helpers/testing-library';
import { EMPTY_STRING, NULL_STRING } from 'src/utils/common';
import { getSimpleSQLExpression } from '.';
import { Operators } from '../constants';

// Add cleanup after each test
afterEach(async () => {
  cleanup();
  // Wait for any pending effects to complete
  await new Promise(resolve => setTimeout(resolve, 0));
});

const params = {
  subject: 'subject',
  operator: 'operator',
  comparator: 'comparator',
};

test('Should return "" if subject is falsy', () => {
  expect(getSimpleSQLExpression('', params.operator, params.comparator)).toBe(
    '',
  );
  expect(getSimpleSQLExpression(null, params.operator, params.comparator)).toBe(
    '',
  );
  expect(
    getSimpleSQLExpression(undefined, params.operator, params.comparator),
  ).toBe('');
});

test('Should return null string and empty string', () => {
  expect(getSimpleSQLExpression(params.subject, Operators.In, [null, ''])).toBe(
    `subject ${Operators.In} (${NULL_STRING}, ${EMPTY_STRING})`,
  );
});

test('Should return subject if operator is falsy', () => {
  expect(getSimpleSQLExpression(params.subject, '', params.comparator)).toBe(
    params.subject,
  );
  expect(getSimpleSQLExpression(params.subject, null, params.comparator)).toBe(
    params.subject,
  );
  expect(
    getSimpleSQLExpression(params.subject, undefined, params.comparator),
  ).toBe(params.subject);
});

test('Should return correct string when subject and operator are valid values', () => {
  expect(
    getSimpleSQLExpression(params.subject, params.operator, params.comparator),
  ).toBe("subject operator 'comparator'");

  expect(
    getSimpleSQLExpression(params.subject, params.operator, [
      params.comparator,
      'comparator-2',
    ]),
  ).toBe("subject operator 'comparator', 'comparator-2'");
});
