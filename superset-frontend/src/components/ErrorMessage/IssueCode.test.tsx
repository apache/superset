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
import IssueCode from './IssueCode';

const mockedProps = {
  code: 1,
  message: 'Error message',
};

test('should render', () => {
  const { container } = render(<IssueCode {...mockedProps} />);
  expect(container).toBeInTheDocument();
});

test('should render the message', () => {
  render(<IssueCode {...mockedProps} />);
  expect(screen.getByText('Error message')).toBeInTheDocument();
});

test('should render the link', () => {
  render(<IssueCode {...mockedProps} />);
  const link = screen.getByRole('link');
  expect(link).toHaveAttribute(
    'href',
    `https://superset.apache.org/docs/using-superset/issue-codes#issue-${mockedProps.code}`,
  );
});
