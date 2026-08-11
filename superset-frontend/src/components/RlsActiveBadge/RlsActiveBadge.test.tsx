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

import RlsActiveBadge from '.';

// @AC-FR9-01
test('renders the badge when row filters are active', () => {
  render(<RlsActiveBadge rlsEnforcement={{ row_filters_active: true }} />);
  expect(screen.getByText('Row-level filters active')).toBeInTheDocument();
});

// @AC-FR9-01
test('does not render when the server flag is false', () => {
  render(<RlsActiveBadge rlsEnforcement={{ row_filters_active: false }} />);
  expect(
    screen.queryByText('Row-level filters active'),
  ).not.toBeInTheDocument();
});

// @AC-FR9-01
test('does not render when enforcement information is absent', () => {
  const { container } = render(<RlsActiveBadge />);
  expect(
    screen.queryByText('Row-level filters active'),
  ).not.toBeInTheDocument();
  expect(container).toBeEmptyDOMElement();
});

// @AC-FR9-01
test('is passive with no interactive control', () => {
  render(<RlsActiveBadge rlsEnforcement={{ row_filters_active: true }} />);
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
  const badge = screen.getByTestId('rls-active-badge');
  expect(badge).not.toHaveAttribute('onclick');
  expect(badge.tagName.toLowerCase()).not.toBe('button');
});
