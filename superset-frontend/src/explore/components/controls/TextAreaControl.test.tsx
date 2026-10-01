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
import { useState } from 'react';
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from 'spec/helpers/testing-library';

import TextAreaControl from 'src/explore/components/controls/TextAreaControl';

const defaultProps = {
  name: 'x_axis_label',
  label: 'X Axis Label',
  onChange: jest.fn(),
};

// eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
describe('TextArea', () => {
  test('renders a FormControl', () => {
    render(<TextAreaControl {...defaultProps} />);
    expect(screen.getByRole('textbox')).toBeVisible();
  });

  test('calls onChange when toggled', () => {
    render(<TextAreaControl {...defaultProps} />);
    const textArea = screen.getByRole('textbox');
    fireEvent.change(textArea, { target: { value: 'x' } });
    expect(defaultProps.onChange).toHaveBeenCalledWith('x');
  });

  test('renders a AceEditor when language is specified', async () => {
    const props = { ...defaultProps, language: 'markdown' as const };
    const { container } = render(<TextAreaControl {...props} />);
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    await waitFor(() => {
      expect(container.querySelector('.ace_text-input')).toBeInTheDocument();
    });
  });

  test('calls onAreaEditorChange when entering in the AceEditor', () => {
    const props = { ...defaultProps, language: 'markdown' as const };
    render(<TextAreaControl {...props} />);
    const textArea = screen.getByRole('textbox');
    fireEvent.change(textArea, { target: { value: 'x' } });
    expect(defaultProps.onChange).toHaveBeenCalledWith('x');
  });

  test('picks up an externally changed initialValue without remounting the AceEditor', async () => {
    function Wrapper() {
      const [initialValue, setInitialValue] = useState('first');
      return (
        <>
          <button
            type="button"
            onClick={() => setInitialValue('synced-from-source')}
          >
            sync
          </button>
          <TextAreaControl
            name="expr"
            language="sql"
            initialValue={initialValue}
            onChange={() => {}}
          />
        </>
      );
    }
    const { container } = render(<Wrapper />);
    await waitFor(() => {
      expect(container.querySelector('.ace_text-input')).toBeInTheDocument();
    });
    // react-ace keeps a reference to the live editor instance on the
    // container node's `env`, which lets us read the underlying Ace
    // document directly; jsdom doesn't paint Ace's text layer, so the
    // rendered DOM has no visible text to assert against.
    const editorNode = container.querySelector('.ace_editor') as HTMLElement & {
      env: { editor: { getValue: () => string } };
    };
    expect(editorNode.env.editor.getValue()).toBe('first');

    fireEvent.click(screen.getByText('sync'));

    await waitFor(() => {
      expect(editorNode.env.editor.getValue()).toBe('synced-from-source');
    });
    // Same editor instance picked up the new value; it was not remounted.
    expect(container.querySelector('.ace_editor')).toBe(editorNode);
  });
});
