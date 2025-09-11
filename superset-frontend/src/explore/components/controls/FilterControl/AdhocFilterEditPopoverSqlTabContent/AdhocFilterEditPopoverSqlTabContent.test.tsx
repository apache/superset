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
import { render, screen, selectOption } from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';
import { IAceEditorProps } from 'react-ace';
import AdhocFilter from '../AdhocFilter';
import { Clauses, ExpressionTypes } from '../types';
import AdhocFilterEditPopoverSqlTabContent from '.';

jest.mock('src/components/AsyncAceEditor', () => ({
  SQLEditor: ({ value, onChange }: IAceEditorProps) => (
    <textarea
      defaultValue={value}
      onChange={value => onChange?.(value.target.value)}
    />
  ),
}));

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
  expect(onChange).toHaveBeenCalledWith(
    expect.objectContaining({ clause: Clauses.Having }),
  );
});

test('calls onChange when the SQL expression changes', () => {
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
  userEvent.paste(sqlEditor, input);
  expect(onChange).toHaveBeenCalledWith(
    expect.objectContaining({ sqlExpression: input }),
  );
});
