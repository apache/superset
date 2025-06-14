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
import { render } from 'spec/helpers/testing-library';

import TextControl from 'src/explore/components/controls/TextControl';
import FormRow from 'src/components/FormRow';

jest.mock('@superset-ui/chart-controls', () => ({
  ...jest.requireActual('@superset-ui/chart-controls'),
  InfoTooltipWithTrigger: () => <div data-test="mock-info-tooltip" />,
}));
jest.mock('src/components', () => ({
  ...jest.requireActual('src/components'),
  Row: ({ children }) => <div data-test="mock-row">{children}</div>,
  Col: ({ children }) => <div data-test="mock-col">{children}</div>,
}));

const defaultProps = {
  label: 'Hello',
  tooltip: 'A tooltip',
  control: <TextControl label="test_cbox" />,
};

const setup = (overrideProps = {}) => {
  const props = {
    ...defaultProps,
    ...overrideProps,
  };
  return render(<FormRow {...props} />);
};

test('renders an InfoTooltipWithTrigger only if needed', () => {
  const { getByTestId, queryByTestId, rerender } = setup();
  expect(getByTestId('mock-info-tooltip')).toBeInTheDocument();
  rerender(<FormRow {...defaultProps} tooltip={null} />);
  expect(queryByTestId('mock-info-tooltip')).not.toBeInTheDocument();
});

test('renders a Row and 2 Cols', () => {
  const { getByTestId, getAllByTestId } = setup();
  expect(getByTestId('mock-row')).toBeInTheDocument();
  expect(getAllByTestId('mock-col')).toHaveLength(2);
});
