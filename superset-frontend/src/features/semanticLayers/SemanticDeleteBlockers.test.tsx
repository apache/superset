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
import SemanticDeleteBlockers, {
  SemanticDeleteError,
} from './SemanticDeleteBlockers';

test('markup in the refusal is shown as text, not rendered as HTML', () => {
  const error = {
    error: '<img src=x onerror=alert(1)>Blocked',
    dependents: [
      { type: 'chart', id: 7, name: '<b>Revenue</b>', archived: false },
      {
        type: 'dashboard',
        id: '/evil.example' as unknown as number,
        name: 'Odd board',
        archived: false,
      },
    ],
  } satisfies SemanticDeleteError;
  const { container } = render(<SemanticDeleteBlockers error={error} />);
  expect(
    screen.getByText('<img src=x onerror=alert(1)>Blocked'),
  ).toBeInTheDocument();
  expect(screen.getByRole('link', { name: '<b>Revenue</b>' })).toHaveAttribute(
    'href',
    '/explore/?slice_id=7',
  );
  expect(container.querySelector('img, b')).toBeNull();
  // An id that is not a whole number never becomes a link.
  expect(screen.getByText(/Odd board/)).toBeInTheDocument();
  expect(
    screen.queryByRole('link', { name: 'Odd board' }),
  ).not.toBeInTheDocument();
});
