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
import { isValidElement } from 'react';
import { render } from 'spec/helpers/testing-library';
import ColumnElement from 'src/SqlLab/components/ColumnElement';
import { mockedActions, table } from 'src/SqlLab/fixtures';

// eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
describe('ColumnElement', () => {
  const mockedProps = {
    actions: mockedActions,
    column: table.columns[0],
  };
  test('is valid with props', () => {
    expect(isValidElement(<ColumnElement {...mockedProps} />)).toBe(true);
  });
  test('renders a proper primary key', () => {
    const { container } = render(<ColumnElement column={table.columns[0]} />);
    expect(container.querySelector('i.fa-key')).toBeInTheDocument();
    expect(
      container.querySelector('[data-test="col-name"]')?.firstChild,
    ).toHaveTextContent('id');
  });
  test('renders a multi-key column', () => {
    const { container } = render(<ColumnElement column={table.columns[1]} />);
    expect(container.querySelector('i.fa-link')).toBeInTheDocument();
    expect(container.querySelector('i.fa-bookmark')).toBeInTheDocument();
    expect(
      container.querySelector('[data-test="col-name"]')?.firstChild,
    ).toHaveTextContent('first_name');
  });
  test('renders a column with no keys', () => {
    const { container } = render(<ColumnElement column={table.columns[2]} />);
    expect(container.querySelector('i')).not.toBeInTheDocument();
    expect(
      container.querySelector('[data-test="col-name"]')?.firstChild,
    ).toHaveTextContent('last_name');
  });
});
