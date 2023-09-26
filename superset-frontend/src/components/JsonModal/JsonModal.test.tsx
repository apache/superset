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
import React from 'react';
import { fireEvent, render } from 'spec/helpers/testing-library';
import JsonModal, { convertBigIntStrToNumber } from '.';

jest.mock('react-json-tree', () => ({
  JSONTree: () => <div data-test="mock-json-tree" />,
}));

test('renders JSON object in a tree view in a modal', () => {
  const jsonData = { a: 1 };
  const jsonValue = JSON.stringify(jsonData);
  const { getByText, getByTestId, queryByTestId } = render(
    <JsonModal
      jsonObject={jsonData}
      jsonValue={jsonValue}
      modalTitle="title"
    />,
    {
      useRedux: true,
    },
  );
  expect(queryByTestId('mock-json-tree')).not.toBeInTheDocument();
  const link = getByText(jsonValue);
  fireEvent.click(link);
  expect(getByTestId('mock-json-tree')).toBeInTheDocument();
});

test('renders bigInt value in a number format', () => {
  expect(convertBigIntStrToNumber('123')).toBe('123');
  expect(convertBigIntStrToNumber('some string value')).toBe(
    'some string value',
  );
  expect(convertBigIntStrToNumber('{ a: 123 }')).toBe('{ a: 123 }');
  expect(convertBigIntStrToNumber('"Not a Number"')).toBe('"Not a Number"');
  // trim quotes for bigint string format
  expect(convertBigIntStrToNumber('"-12345678901234567890"')).toBe(
    '-12345678901234567890',
  );
  expect(convertBigIntStrToNumber('"12345678901234567890"')).toBe(
    '12345678901234567890',
  );
});
