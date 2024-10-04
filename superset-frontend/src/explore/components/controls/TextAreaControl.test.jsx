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

describe('TextArea', () => {
  it('renders a FormControl', () => {
    render(<TextAreaControl {...defaultProps} />);
    expect(screen.getByRole('textbox')).toBeVisible();
  });

  it('calls onChange when toggled', () => {
    render(<TextAreaControl {...defaultProps} />);
    const textArea = screen.getByRole('textbox');
    fireEvent.change(textArea, { target: { value: 'x' } });
    expect(defaultProps.onChange).toHaveBeenCalledWith('x');
  });

  it('renders a AceEditor when language is specified', async () => {
    const props = { ...defaultProps, language: 'markdown' };
    const { container } = render(<TextAreaControl {...props} />);
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    await waitFor(() => {
      expect(container.querySelector('.ace_text-input')).toBeInTheDocument();
    });
  });

  it('calls onAreaEditorChange when entering in the AceEditor', () => {
    const props = { ...defaultProps, language: 'markdown' };
    render(<TextAreaControl {...props} />);
    const textArea = screen.getByRole('textbox');
    fireEvent.change(textArea, { target: { value: 'x' } });
    expect(defaultProps.onChange).toHaveBeenCalledWith('x');
  });
});
