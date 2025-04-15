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
  userEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import { FilterBarOrientation } from 'src/dashboard/types';
import CrossFilterTitle from './CrossFilterTitle';

const mockedProps = {
  title: 'test-title',
  orientation: FilterBarOrientation.Horizontal,
  onHighlightFilterSource: jest.fn(),
};

const setup = (props: typeof mockedProps) =>
  render(<CrossFilterTitle {...props} />, {
    useRedux: true,
  });

// Add cleanup
afterEach(async () => {
  // Wait for any pending effects to complete
  await new Promise(resolve => setTimeout(resolve, 0));
});

test('CrossFilterTitle should render', async () => {
  const { container } = setup(mockedProps);
  await waitFor(() => {
    expect(container).toBeInTheDocument();
  });
});

test('Title should be visible', async () => {
  setup(mockedProps);
  await waitFor(() => {
    expect(screen.getByText('test-title')).toBeInTheDocument();
  });
});

test('Search icon should highlight emitter', async () => {
  setup(mockedProps);
  await waitFor(() => {
    const search = screen.getByTestId('cross-filters-highlight-emitter');
    expect(search).toBeInTheDocument();
  });

  const search = screen.getByTestId('cross-filters-highlight-emitter');
  await userEvent.click(search);

  await waitFor(() => {
    expect(mockedProps.onHighlightFilterSource).toHaveBeenCalled();
  });
});
