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
import { render, screen, waitFor } from 'spec/helpers/testing-library';
import { CssEditor as AceCssEditor } from 'src/components/AsyncAceEditor';
import { IAceEditorProps } from 'react-ace';
import userEvent from '@testing-library/user-event';
import fetchMock from 'fetch-mock';
import CssEditor from '.';

jest.mock('src/components/AsyncAceEditor', () => ({
  CssEditor: ({ value, onChange }: IAceEditorProps) => (
    <textarea
      defaultValue={value}
      onChange={value => onChange?.(value.target.value)}
    />
  ),
}));

const templates = [
  { template_name: 'Template A', css: 'background-color: red;' },
  { template_name: 'Template B', css: 'background-color: blue;' },
  { template_name: 'Template C', css: 'background-color: yellow;' },
];

fetchMock.get('glob:*/csstemplateasyncmodelview/api/read', {
  result: templates,
});

AceCssEditor.preload = () => new Promise(() => {});

const defaultProps = {
  triggerNode: <>Click</>,
  addDangerToast: jest.fn(),
};

test('renders with default props', async () => {
  await waitFor(() => render(<CssEditor {...defaultProps} />));
  expect(screen.getByRole('button', { name: 'Click' })).toBeInTheDocument();
});

test('renders with initial CSS', async () => {
  const initialCss = 'margin: 10px;';
  await waitFor(() =>
    render(<CssEditor {...defaultProps} initialCss={initialCss} />),
  );
  userEvent.click(screen.getByRole('button', { name: 'Click' }));
  expect(screen.getByText(initialCss)).toBeInTheDocument();
});

test('renders with templates', async () => {
  await waitFor(() => render(<CssEditor {...defaultProps} />));
  userEvent.click(screen.getByRole('button', { name: 'Click' }));
  userEvent.hover(screen.getByText('Load a CSS template'));
  await waitFor(() => {
    templates.forEach(template =>
      expect(screen.getByText(template.template_name)).toBeInTheDocument(),
    );
  });
});

test('triggers onChange when using the editor', async () => {
  const onChange = jest.fn();
  const initialCss = 'margin: 10px;';
  const additionalCss = 'color: red;';
  await waitFor(() =>
    render(
      <CssEditor
        {...defaultProps}
        initialCss={initialCss}
        onChange={onChange}
      />,
    ),
  );
  userEvent.click(screen.getByRole('button', { name: 'Click' }));
  expect(onChange).not.toHaveBeenCalled();
  userEvent.type(screen.getByText(initialCss), additionalCss);
  expect(onChange).toHaveBeenLastCalledWith(initialCss.concat(additionalCss));
});

test('triggers onChange when selecting a template', async () => {
  const onChange = jest.fn();
  await waitFor(() =>
    render(<CssEditor {...defaultProps} onChange={onChange} />),
  );
  userEvent.click(screen.getByRole('button', { name: 'Click' }));
  userEvent.click(screen.getByText('Load a CSS template'));
  expect(onChange).not.toHaveBeenCalled();
  userEvent.click(await screen.findByText('Template A'));
  expect(onChange).toHaveBeenCalledTimes(1);
});
