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
import { render, screen } from 'spec/helpers/testing-library';
import { CssEditor as AceCssEditor } from 'src/components/AsyncAceEditor';
import { AceEditorProps } from 'react-ace';
import userEvent from '@testing-library/user-event';
import CssEditor from '.';

jest.mock('src/components/AsyncAceEditor', () => ({
  CssEditor: ({ value, onChange }: AceEditorProps) => (
    <textarea
      defaultValue={value}
      onChange={value => onChange?.(value.target.value)}
    />
  ),
}));

AceCssEditor.preload = () => new Promise(() => {});

test('renders with default props', () => {
  render(<CssEditor triggerNode={<>Click</>} />);
  expect(screen.getByRole('button', { name: 'Click' })).toBeInTheDocument();
});

test('renders with initial CSS', () => {
  const initialCss = 'margin: 10px;';
  render(<CssEditor triggerNode={<>Click</>} initialCss={initialCss} />);
  userEvent.click(screen.getByRole('button', { name: 'Click' }));
  expect(screen.getByText(initialCss)).toBeInTheDocument();
});

test('renders with templates', () => {
  const templates = ['Template A', 'Template B', 'Template C'];
  render(<CssEditor triggerNode={<>Click</>} templates={templates} />);
  userEvent.click(screen.getByRole('button', { name: 'Click' }));
  userEvent.click(screen.getByText('Load a CSS template'));
  templates.forEach(template =>
    expect(screen.getByText(template)).toBeInTheDocument(),
  );
});

test('triggers onChange when using the editor', () => {
  const onChange = jest.fn();
  const initialCss = 'margin: 10px;';
  const additionalCss = 'color: red;';
  render(
    <CssEditor
      triggerNode={<>Click</>}
      initialCss={initialCss}
      onChange={onChange}
    />,
  );
  userEvent.click(screen.getByRole('button', { name: 'Click' }));
  expect(onChange).not.toHaveBeenCalled();
  userEvent.type(screen.getByText(initialCss), additionalCss);
  expect(onChange).toHaveBeenLastCalledWith(initialCss.concat(additionalCss));
});

test('triggers onChange when selecting a template', () => {
  const onChange = jest.fn();
  const templates = ['Template A', 'Template B', 'Template C'];
  render(
    <CssEditor
      triggerNode={<>Click</>}
      templates={templates}
      onChange={onChange}
    />,
  );
  userEvent.click(screen.getByRole('button', { name: 'Click' }));
  userEvent.click(screen.getByText('Load a CSS template'));
  expect(onChange).not.toHaveBeenCalled();
  userEvent.click(screen.getByText('Template A'));
  expect(onChange).toHaveBeenCalledTimes(1);
});
