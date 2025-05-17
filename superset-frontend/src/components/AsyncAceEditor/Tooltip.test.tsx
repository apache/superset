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
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS
 * OF ANY KIND, either express or implied.  See the License for
 * the specific language governing permissions and limitations
 * under the License.
 */

import { render, screen } from 'spec/helpers/testing-library';
import Tooltip, { getTooltipHTML } from './Tooltip';

test('should render a tooltip (React)', () => {
  const props = {
    title: 'tooltip title',
    icon: <div>icon</div>,
    body: 'body text',
    meta: 'meta info',
    footer: 'footer note',
  };

  render(<Tooltip {...props} />);

  expect(screen.getByText('tooltip title')).toBeInTheDocument();
  expect(screen.getByText('meta info')).toBeInTheDocument();
  expect(screen.getByText('icon')).toBeInTheDocument();
  expect(screen.getByText('body text')).toBeInTheDocument();
  expect(screen.getByText('footer note')).toBeInTheDocument();
});

test('getTooltipHTML returns the expected HTML (string inputs)', () => {
  const html = getTooltipHTML({
    title: 'tooltip title',
    icon: '🔥',
    body: 'body text',
    meta: 'meta info',
    footer: 'footer note',
  });

  expect(html).toContain('tooltip-detail');
  expect(html).toContain('tooltip title');
  expect(html).toContain('🔥');
  expect(html).toContain('body text');
  expect(html).toContain('meta info');
  expect(html).toContain('footer note');
});
