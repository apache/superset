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
import PublishConfirmation from './PublishConfirmation';
import type { PublishReview } from './useDraftActions';

const review = (): PublishReview => ({
  parts: [
    {
      title: 'Revenue notes',
      lines: ['Reads Sales as each viewer', 'Uses d3 7.9.0'],
      publish: () => Promise.resolve(),
    },
  ],
  confirm: jest.fn(),
  cancel: jest.fn(),
});

test('the person reads every part before anything is published', async () => {
  const shown = review();
  render(<PublishConfirmation review={shown} busy={false} />);

  expect(screen.getByText('Publish this canvas?')).toBeInTheDocument();
  expect(screen.getByText('Revenue notes')).toBeInTheDocument();
  expect(screen.getByText('Reads Sales as each viewer')).toBeInTheDocument();
  expect(screen.getByText('Uses d3 7.9.0')).toBeInTheDocument();
  expect(shown.confirm).not.toHaveBeenCalled();

  await userEvent.click(screen.getByRole('button', { name: 'Publish' }));

  expect(shown.confirm).toHaveBeenCalled();
});

test('cancelling closes the review', async () => {
  const shown = review();
  render(<PublishConfirmation review={shown} busy={false} />);

  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

  expect(shown.cancel).toHaveBeenCalled();
  expect(shown.confirm).not.toHaveBeenCalled();
});

test('nothing is shown while nothing is reviewed', () => {
  render(<PublishConfirmation review={undefined} busy={false} />);

  expect(screen.queryByText('Publish this canvas?')).toBeNull();
});
