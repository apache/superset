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
import { render, screen, fireEvent } from '@superset-ui/core/spec';
import '@testing-library/jest-dom';
import { Radio } from '.';

describe('Radio Component', () => {
  test('renders radio button and allows selection', () => {
    render(
      <Radio.Group>
        <Radio value="option1">Option 1</Radio>
        <Radio value="option2">Option 2</Radio>
      </Radio.Group>,
    );

    const option1 = screen.getByLabelText('Option 1');
    const option2 = screen.getByLabelText('Option 2');

    expect(option1).not.toBeChecked();
    expect(option2).not.toBeChecked();

    fireEvent.click(option1);
    expect(option1).toBeChecked();
    expect(option2).not.toBeChecked();

    fireEvent.click(option2);
    expect(option1).not.toBeChecked();
    expect(option2).toBeChecked();
  });
});

test.each([
  ['Radio', <Radio key="radio" value="a" />],
  ['Radio.Button', <Radio.Button key="button" value="a" />],
  [
    'Radio.Group',
    <Radio.Group key="group" options={[{ label: 'A', value: 'a' }]} />,
  ],
])('%s border uses colorTextTertiary for non-text contrast', (_, element) => {
  const { container } = render(element);
  const radio = container.querySelector(
    '.ant-radio-wrapper, .ant-radio-button-wrapper',
  ) as Element;
  expect(getComputedStyle(radio).getPropertyValue('--ant-color-border')).toBe(
    supersetTheme.colorTextTertiary,
  );
});
