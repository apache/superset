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
import '@testing-library/jest-dom';
import { render } from '@superset-ui/core/spec';
import SelectPageSize from './index';

test('renders page size selector with options', () => {
  const onChange = jest.fn();
  const { container } = render(
    <SelectPageSize
      options={[
        [10, '10'],
        [25, '25'],
        [50, '50'],
      ]}
      current={10}
      onChange={onChange}
    />,
  );

  const wrapper = container.querySelector('.dt-select-page-size');
  expect(wrapper).toHaveTextContent('Show');
  expect(wrapper).toHaveTextContent('entries per page');
});

test('has visually hidden label for accessibility', () => {
  const onChange = jest.fn();
  const { container } = render(
    <SelectPageSize options={[[10, '10']]} current={10} onChange={onChange} />,
  );

  const label = container.querySelector('label[for="pageSizeSelect"]');
  expect(label).toHaveTextContent('Select page size');
  expect(label).toHaveAttribute('for', 'pageSizeSelect');
});

test('select has proper id for label association', () => {
  const onChange = jest.fn();
  const { container } = render(
    <SelectPageSize options={[[10, '10']]} current={10} onChange={onChange} />,
  );

  const select = container.querySelector('#pageSizeSelect');
  expect(select).toHaveAttribute('id', 'pageSizeSelect');
  expect(select).toBeTruthy();
});

test('visually hidden label is not visible in UI', () => {
  const onChange = jest.fn();
  const { container } = render(
    <SelectPageSize options={[[10, '10']]} current={10} onChange={onChange} />,
  );

  const label = container.querySelector('label[for="pageSizeSelect"]');
  const styles = window.getComputedStyle(label!);

  expect(styles.position).toBe('absolute');
  expect(styles.width).toBe('1px');
  expect(styles.height).toBe('1px');
});
