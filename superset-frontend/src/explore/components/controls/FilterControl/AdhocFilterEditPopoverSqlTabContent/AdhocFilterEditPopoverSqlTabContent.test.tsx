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
  cleanup,
  render,
  screen,
  selectOption,
  userEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import AdhocFilter from '../AdhocFilter';
import { Clauses, ExpressionTypes } from '../types';
import AdhocFilterEditPopoverSqlTabContent from '.';

// Track resize calls for testing
const mockResize = jest.fn();

// Mock EditorHost with ref support for resize
jest.mock('src/core/editors', () => {
  const React = require('react');
  return {
    EditorHost: React.forwardRef(
      (
        {
          value,
          onChange,
        }: {
          value: string;
          onChange: (v: string) => void;
        },
        ref: React.Ref<{ resize: () => void }>,
      ) => {
        React.useImperativeHandle(ref, () => ({
          resize: mockResize,
        }));
        return (
          <textarea
            defaultValue={value}
            onChange={e => onChange?.(e.target.value)}
          />
        );
      },
    ),
  };
});

// Add cleanup after each test
afterEach(async () => {
  cleanup();
  mockResize.mockClear();
  // Wait for any pending effects to complete
  await new Promise(resolve => setTimeout(resolve, 0));
});

const adhocFilter = new AdhocFilter({
  expressionType: ExpressionTypes.Sql,
  sqlExpression: 'value > 10',
  clause: Clauses.Where,
});

test('calls onChange when the SQL clause changes', async () => {
  const onChange = jest.fn();
  render(
    <AdhocFilterEditPopoverSqlTabContent
      adhocFilter={adhocFilter}
      onChange={onChange}
      options={[]}
      height={100}
    />,
  );
  await selectOption(Clauses.Having);
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(onChange).toHaveBeenCalledWith(
    expect.objectContaining({ clause: Clauses.Having }),
  );
});

test('calls onChange when the SQL expression changes', async () => {
  const onChange = jest.fn();
  const input = 'value < 20';
  render(
    <AdhocFilterEditPopoverSqlTabContent
      adhocFilter={adhocFilter}
      onChange={onChange}
      options={[]}
      height={100}
    />,
  );
  const sqlEditor = screen.getByRole('textbox');
  expect(sqlEditor).toBeInTheDocument();
  userEvent.clear(sqlEditor);
  await userEvent.paste(sqlEditor, input);
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(onChange).toHaveBeenCalledWith(
    expect.objectContaining({ sqlExpression: input }),
  );
});

test('calls editor resize when adhocFilter changes', async () => {
  const onChange = jest.fn();
  const { rerender } = render(
    <AdhocFilterEditPopoverSqlTabContent
      adhocFilter={adhocFilter}
      onChange={onChange}
      options={[]}
      height={100}
    />,
  );

  // Initial render should call resize
  await waitFor(() => {
    expect(mockResize).toHaveBeenCalled();
  });
  mockResize.mockClear();

  // Create a new filter to trigger the useEffect
  const newFilter = new AdhocFilter({
    expressionType: ExpressionTypes.Sql,
    sqlExpression: 'value > 20',
    clause: Clauses.Where,
  });

  rerender(
    <AdhocFilterEditPopoverSqlTabContent
      adhocFilter={newFilter}
      onChange={onChange}
      options={[]}
      height={100}
    />,
  );

  await waitFor(() => {
    expect(mockResize).toHaveBeenCalled();
  });
});
