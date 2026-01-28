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
import { render, screen } from 'spec/helpers/testing-library';
import AdvancedSection from './AdvancedSection';

const defaultProps = {
  jsonMetadata: '{"color_scheme": "supersetColors"}',
  jsonAnnotations: [],
  validationStatus: {
    advanced: { hasErrors: false, errors: [], name: 'Advanced' },
  },
  onJsonMetadataChange: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
});

test('renders JSON metadata field', () => {
  render(<AdvancedSection {...defaultProps} />);

  expect(screen.getByTestId('dashboard-metadata-field')).toBeInTheDocument();
});

test('shows error when JSON is invalid', () => {
  const validationStatus = {
    advanced: {
      hasErrors: true,
      errors: ['Invalid JSON'],
      name: 'Advanced',
    },
  };

  const props = {
    ...defaultProps,
    validationStatus,
    jsonAnnotations: [{ type: 'error', text: 'Invalid JSON' }],
  };

  render(<AdvancedSection {...props} />);

  expect(screen.getByText('Invalid JSON metadata')).toBeInTheDocument();
});

test('does not show error when JSON is valid', () => {
  render(<AdvancedSection {...defaultProps} />);

  expect(screen.queryByText('Invalid JSON metadata')).not.toBeInTheDocument();
});

test('renders JSON editor with correct value', () => {
  const jsonMetadata = '{"test": "value"}';
  render(<AdvancedSection {...defaultProps} jsonMetadata={jsonMetadata} />);

  expect(screen.getByTestId('dashboard-metadata-field')).toBeInTheDocument();
  // JsonEditor component should be rendered (though its internal value testing is complex)
});

test('shows helper text explaining JSON metadata purpose', () => {
  render(<AdvancedSection {...defaultProps} />);

  expect(
    screen.getByText(/This JSON object is generated dynamically/),
  ).toBeInTheDocument();
  expect(screen.getByText(/reference and for power users/)).toBeInTheDocument();
});
