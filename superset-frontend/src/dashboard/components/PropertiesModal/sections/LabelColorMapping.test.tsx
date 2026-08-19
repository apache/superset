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
  render,
  screen,
  fireEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import LabelColorMapping from './LabelColorMapping';

const defaultProps = {
  jsonMetadata: '{}',
  onJsonMetadataChange: jest.fn(),
};

describe('LabelColorMapping', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders the empty state correctly', () => {
    render(<LabelColorMapping {...defaultProps} />);
    expect(screen.getByText('Label Colors')).toBeInTheDocument();
    expect(
      screen.getByText(
        'No color mappings defined. Click "+ Add more" to get started.',
      ),
    ).toBeInTheDocument();
  });

  test('adds a new color mapping row when "Add more" is clicked', () => {
    render(<LabelColorMapping {...defaultProps} />);

    const addButton = screen.getByText('+ Add more');
    fireEvent.click(addButton);

    expect(
      screen.getByPlaceholderText('Select or type a label'),
    ).toBeInTheDocument();
  });

  test('renders existing mappings from jsonMetadata', async () => {
    const propsWithData = {
      ...defaultProps,
      jsonMetadata: JSON.stringify({ label_colors: { Revenue: '#20a7c9' } }),
    };
    render(<LabelColorMapping {...propsWithData} />);

    await waitFor(() => {
      // We verify the data loaded successfully by checking the label.
      // (The Ant Design ColorPicker manages the color internally as a visual swatch).
      expect(screen.getByDisplayValue('Revenue')).toBeInTheDocument();
    });
  });
});
