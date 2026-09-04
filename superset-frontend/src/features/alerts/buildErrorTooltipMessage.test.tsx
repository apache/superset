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
import { buildErrorTooltipMessage } from './buildErrorTooltipMessage';
import { SectionValidationObject } from './types';

const noErrors: SectionValidationObject = {
  hasErrors: false,
  errors: [],
  name: 'No Errors',
};

const singleError: SectionValidationObject = {
  hasErrors: true,
  errors: ['first error'],
  name: 'Single Error',
};

const threeErrors: SectionValidationObject = {
  hasErrors: true,
  errors: ['first error', 'second error', 'third error'],
  name: 'Triple Error',
};

const validation = { noErrors, singleError, threeErrors };

test('builds with proper heading', () => {
  render(buildErrorTooltipMessage(validation));
  const heading = screen.getByText(
    /not all required fields are complete\. please provide the following:/i,
  );
  expect(heading).toBeInTheDocument();
});

test('only builds sections that have errors', async () => {
  render(buildErrorTooltipMessage(validation));
  const noErrors = screen.queryByText(/no errors: /i);
  const singleError = screen.getByText(/single error:/i);
  const tripleError = screen.getByText(/triple error:/i);
  expect(noErrors).not.toBeInTheDocument();
  expect(singleError).toBeInTheDocument();
  expect(tripleError).toBeInTheDocument();
});

test('properly concatenates errors', async () => {
  render(buildErrorTooltipMessage(validation));
  const singleError = screen.getByText(/single error: first error/i);
  const tripleError = screen.getByText(
    /triple error: first error, second error, third error/i,
  );
  expect(singleError).toBeInTheDocument();
  expect(tripleError).toBeInTheDocument();
});
