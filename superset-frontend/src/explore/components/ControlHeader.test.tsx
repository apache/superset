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
import { render, screen, userEvent } from 'spec/helpers/testing-library';
import ControlHeader, {
  ControlHeaderProps,
} from 'src/explore/components/ControlHeader';

const defaultProps: ControlHeaderProps = {
  name: 'time_range',
  label: 'Time Range',
  description: 'Filter dataset by temporal boundaries',
};

test('renders control label without description icon when not hovered', () => {
  render(<ControlHeader {...defaultProps} hovered={false} />);
  expect(screen.getByText('Time Range')).toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: /info-circle/i }),
  ).not.toBeInTheDocument();
});

test('renders description icon outside label when hovered', async () => {
  render(<ControlHeader {...defaultProps} hovered />);
  const label = screen.getByText('Time Range');
  const infoIcon = screen.getByRole('button', { name: /info-circle/i });
  expect(infoIcon).toBeInTheDocument();
  // Ensure info icon is not a descendant of FormLabel / label
  const formLabel = label.closest('label');
  expect(formLabel).not.toContainElement(infoIcon);
});

test('shows description tooltip when info icon is hovered', async () => {
  render(<ControlHeader {...defaultProps} hovered />);
  const infoIcon = screen.getByRole('button', { name: /info-circle/i });
  await userEvent.hover(infoIcon);
  expect(
    await screen.findByText('Filter dataset by temporal boundaries'),
  ).toBeInTheDocument();
});
