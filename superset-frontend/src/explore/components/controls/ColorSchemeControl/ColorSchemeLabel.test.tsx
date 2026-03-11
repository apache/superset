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
import ColorSchemeLabel from './ColorSchemeLabel';

const defaultProps = {
  colors: [
    '#000000',
    '#FFFFFF',
    '#CCCCCC',
    '#000000',
    '#FFFFFF',
    '#CCCCCC',
    '#000000',
    '#FFFFFF',
    '#CCCCCC',
    '#000000',
    '#FFFFFF',
    '#CCCCCC',
  ],
  label: 'Superset Colors',
  id: 'colorScheme',
};

const setup = (overrides?: Record<string, any>) =>
  render(<ColorSchemeLabel {...defaultProps} {...overrides} />);

test('should render', async () => {
  const { container } = setup();
  await waitFor(() => expect(container).toBeVisible());
});

test('should render the label', () => {
  setup();
  expect(screen.getByText('Superset Colors')).toBeInTheDocument();
});

test('should render the colors', () => {
  setup();
  const allColors = screen.getAllByTestId('color');
  expect(allColors).toHaveLength(12);
});
