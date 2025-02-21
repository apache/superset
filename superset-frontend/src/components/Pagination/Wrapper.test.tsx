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

import { render, screen, cleanup } from 'spec/helpers/testing-library';
import Wrapper from './Wrapper';

// Add cleanup after each test
afterEach(async () => {
  cleanup();
  // Wait for any pending effects to complete
  await new Promise(resolve => setTimeout(resolve, 0));
});

jest.mock('./Next', () => ({
  Next: () => <div data-test="next" />,
}));
jest.mock('./Prev', () => ({
  Prev: () => <div data-test="prev" />,
}));
jest.mock('./Item', () => ({
  Item: () => <div data-test="item" />,
}));
jest.mock('./Ellipsis', () => ({
  Ellipsis: () => <div data-test="ellipsis" />,
}));

test('Pagination rendering correctly', async () => {
  render(
    <Wrapper>
      <li data-test="test" />
    </Wrapper>,
  );
  expect(screen.getByRole('navigation')).toBeInTheDocument();
  expect(screen.getByTestId('test')).toBeInTheDocument();
});

test('Next attribute', async () => {
  render(<Wrapper.Next onClick={jest.fn()} />);
  expect(screen.getByTestId('next')).toBeInTheDocument();
});

test('Prev attribute', async () => {
  render(<Wrapper.Next onClick={jest.fn()} />);
  expect(screen.getByTestId('next')).toBeInTheDocument();
});

test('Item attribute', async () => {
  render(
    <Wrapper.Item onClick={jest.fn()}>
      <></>
    </Wrapper.Item>,
  );
  expect(screen.getByTestId('item')).toBeInTheDocument();
});

test('Ellipsis attribute', async () => {
  render(<Wrapper.Ellipsis onClick={jest.fn()} />);
  expect(screen.getByTestId('ellipsis')).toBeInTheDocument();
});
