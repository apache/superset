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
import { supersetTheme } from '@apache-superset/core/theme';
import { render } from '@superset-ui/core/spec';
import { Input, InputNumber } from '.';

test('should render Input', () => {
  const { container } = render(<Input />);
  expect(container).toBeInTheDocument();
});

test('should render InputNumber', () => {
  const { container } = render(<InputNumber />);
  expect(container).toBeInTheDocument();
});

test('should render TextArea', () => {
  const { container } = render(<Input.TextArea />);
  expect(container).toBeInTheDocument();
});

// WCAG 2.1 SC 1.4.11: the rest-state border must reach 3:1 against the background.
const restBorderColor = (container: HTMLElement) =>
  getComputedStyle(
    container.querySelector('[class*="-css-var"]') as Element,
  ).getPropertyValue('--ant-color-border');

test.each([
  ['Input', <Input key="input" />],
  ['TextArea', <Input.TextArea key="textarea" />],
  ['Password', <Input.Password key="password" />],
  ['Search', <Input.Search key="search" />],
  ['InputNumber', <InputNumber key="number" />],
])('%s border uses colorTextTertiary for non-text contrast', (_, element) => {
  const { container } = render(element);
  expect(restBorderColor(container)).toBe(supersetTheme.colorTextTertiary);
});
