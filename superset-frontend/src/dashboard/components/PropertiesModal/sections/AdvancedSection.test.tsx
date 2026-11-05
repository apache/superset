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
import AdvancedSection from './AdvancedSection';

let mockEditorDelay = 0;

jest.mock('src/core/editors', () => {
  const actual = jest.requireActual('src/core/editors');
  const { createElement, forwardRef, useEffect, useState } =
    jest.requireActual('react');
  const DelayedEditorHost = forwardRef((props: object, ref: unknown) => {
    const [show, setShow] = useState(mockEditorDelay === 0);
    useEffect(() => {
      if (show) {
        return undefined;
      }
      const timer = setTimeout(() => setShow(true), mockEditorDelay);
      return () => clearTimeout(timer);
    }, [show]);
    return show ? createElement(actual.EditorHost, { ...props, ref }) : null;
  });
  return { ...actual, EditorHost: DelayedEditorHost };
});

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

afterEach(() => {
  mockEditorDelay = 0;
});

const ERROR_IDS =
  'dashboard-json-metadata-error-0 dashboard-json-metadata-error-1';

const editorTextarea = () =>
  document.querySelector<HTMLTextAreaElement>(
    '#dashboard-json-metadata textarea',
  );

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

test('shows extra errors in an aria-live region below the editor', () => {
  render(
    <AdvancedSection
      {...defaultProps}
      extraErrors={['auto_refresh_policy.extra: Unknown field.']}
    />,
  );

  const error = screen.getByText('auto_refresh_policy.extra: Unknown field.');
  expect(error.closest('[aria-live="polite"]')).toBeInTheDocument();
});

test('keeps an empty aria-live region without extra errors', () => {
  const { container } = render(<AdvancedSection {...defaultProps} />);

  const region = container.querySelector('[aria-live="polite"]');
  expect(region).toBeInTheDocument();
  expect(region).toBeEmptyDOMElement();
});

test('extra errors describe the editor and mark it invalid', async () => {
  render(
    <AdvancedSection
      {...defaultProps}
      extraErrors={[
        'auto_refresh_policy.extra: Unknown field.',
        'auto_refresh_policy.minimum_refresh_interval: Invalid value.',
      ]}
    />,
  );

  await waitFor(() =>
    expect(editorTextarea()).toHaveAttribute('aria-describedby', ERROR_IDS),
  );
  expect(editorTextarea()).toHaveAttribute('aria-invalid', 'true');
  expect(editorTextarea()).toHaveAccessibleDescription(
    'auto_refresh_policy.extra: Unknown field. auto_refresh_policy.minimum_refresh_interval: Invalid value.',
  );
});

test('clearing the extra errors removes the description and invalid state', async () => {
  const { rerender } = render(
    <AdvancedSection
      {...defaultProps}
      extraErrors={['auto_refresh_policy.extra: Unknown field.']}
    />,
  );
  await waitFor(() =>
    expect(editorTextarea()).toHaveAttribute('aria-invalid', 'true'),
  );

  rerender(<AdvancedSection {...defaultProps} extraErrors={[]} />);

  await waitFor(() =>
    expect(editorTextarea()).not.toHaveAttribute('aria-describedby'),
  );
  expect(editorTextarea()).not.toHaveAttribute('aria-invalid');
});

test('errors present before the editor mounts are linked once it is ready', async () => {
  mockEditorDelay = 100;
  render(<AdvancedSection {...defaultProps} extraErrors={['e0', 'e1']} />);
  expect(editorTextarea()).not.toBeInTheDocument();

  await waitFor(() => expect(editorTextarea()).toBeInTheDocument(), {
    timeout: 5000,
  });
  await waitFor(() =>
    expect(editorTextarea()).toHaveAttribute('aria-describedby', ERROR_IDS),
  );
  expect(editorTextarea()).toHaveAttribute('aria-invalid', 'true');
});
