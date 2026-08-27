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
import { render, screen, selectOption } from 'spec/helpers/testing-library';
import AsyncModeSection from './AsyncModeSection';

const defaultProps = {
  value: 'default' as const,
  onChange: jest.fn(),
};

test('renders the async execution field', () => {
  render(<AsyncModeSection {...defaultProps} />);

  expect(screen.getByText('Asynchronous query execution')).toBeInTheDocument();
  expect(screen.getByText('Deployment default')).toBeInTheDocument();
});

test('reflects the current override value', () => {
  render(<AsyncModeSection {...defaultProps} value="force_on" />);

  expect(screen.getByText('Force enabled')).toBeInTheDocument();
});

test('calls onChange with the selected override', async () => {
  const onChange = jest.fn();

  render(<AsyncModeSection {...defaultProps} onChange={onChange} />);

  await selectOption('Force disabled', 'Asynchronous query execution');

  expect(onChange).toHaveBeenCalledWith('force_off');
});
