import React from 'react';
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

const selector = '[id="brace-editor"]';

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
