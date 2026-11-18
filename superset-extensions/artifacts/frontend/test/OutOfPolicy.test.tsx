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

import { render, screen } from '@testing-library/react';
import type { FrameLink } from '../src/frames/api';
import OutOfPolicy from '../src/frames/OutOfPolicy';

const link = (overrides: Partial<FrameLink>) =>
  ({ can_edit: true, out_of_policy: [], ...overrides }) as FrameLink;

test("an editor learns what the policy no longer admits of the frame's build", () => {
  render(
    <OutOfPolicy
      link={link({ out_of_policy: ['d3 is not allowed', 'too large'] })}
    />,
  );

  expect(screen.getByRole('alert').textContent).toContain(
    'd3 is not allowed; too large',
  );
});

test('a build in policy, or a viewer, gets no notice', () => {
  const { container } = render(
    <>
      <OutOfPolicy link={link({})} />
      <OutOfPolicy link={link({ can_edit: false, out_of_policy: ['x'] })} />
    </>,
  );

  expect(container.innerHTML).toBe('');
});
