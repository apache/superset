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
import Tooltip, { getTooltipHTML } from './Tooltip';

test('should render a tooltip', () => {
  const expected = {
    title: 'tooltip title',
    icon: <div>icon</div>,
    body: <div>body</div>,
    meta: 'meta',
    footer: <div>footer</div>,
  };
  render(<Tooltip {...expected} />);
  expect(screen.getByText(expected.title)).toBeInTheDocument();
  expect(screen.getByText(expected.meta)).toBeInTheDocument();
  expect(screen.getByText('icon')).toBeInTheDocument();
  expect(screen.getByText('body')).toBeInTheDocument();
});

test('returns the tooltip HTML', () => {
  const html = getTooltipHTML({
    title: 'tooltip title',
    icon: <div>icon</div>,
    body: <div>body</div>,
    meta: 'meta',
    footer: <div>footer</div>,
  });
  expect(html).toContain('tooltip title');
});
