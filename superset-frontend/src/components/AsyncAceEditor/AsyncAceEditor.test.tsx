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
import AsyncAceEditor, {
  SQLEditor,
  FullSQLEditor,
  MarkdownEditor,
  TextAreaEditor,
  CssEditor,
  JsonEditor,
  ConfigEditor,
  AceModule,
  AsyncAceEditorOptions,
} from 'src/components/AsyncAceEditor';

const selector = '[id="ace-editor"]';

test('renders SQLEditor', async () => {
  const { container } = render(<SQLEditor />);

  await waitFor(() => {
    expect(container.querySelector(selector)).toBeInTheDocument();
  });
});

test('renders FullSQLEditor', async () => {
  const { container } = render(<FullSQLEditor />);

  await waitFor(() => {
    expect(container.querySelector(selector)).toBeInTheDocument();
  });
});

test('renders MarkdownEditor', async () => {
  const { container } = render(<MarkdownEditor />);

  await waitFor(() => {
    expect(container.querySelector(selector)).toBeInTheDocument();
  });
});

test('renders TextAreaEditor', async () => {
  const { container } = render(<TextAreaEditor />);

  await waitFor(() => {
    expect(container.querySelector(selector)).toBeInTheDocument();
  });
});

test('renders CssEditor', async () => {
  const { container } = render(<CssEditor />);

  await waitFor(() => {
    expect(container.querySelector(selector)).toBeInTheDocument();
  });
});

test('renders JsonEditor', async () => {
  const { container } = render(<JsonEditor />);

  await waitFor(() => {
    expect(container.querySelector(selector)).toBeInTheDocument();
  });
});

test('renders ConfigEditor', async () => {
  const { container } = render(<ConfigEditor />);

  await waitFor(() => {
    expect(container.querySelector(selector)).toBeInTheDocument();
  });
});

test('renders a custom placeholder', () => {
  const aceModules: AceModule[] = ['mode/css', 'theme/github'];
  const editorOptions: AsyncAceEditorOptions = {
    placeholder: () => <p role="paragraph">Custom placeholder</p>,
  };
  const Editor = AsyncAceEditor(aceModules, editorOptions);

  render(<Editor />);

  expect(screen.getByRole('paragraph')).toBeInTheDocument();
});
