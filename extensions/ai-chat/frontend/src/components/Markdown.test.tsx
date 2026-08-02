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
import React from 'react';
import { render, screen } from '@testing-library/react';
import Markdown from './Markdown';

test('renders headings, lists, code and inline formatting', () => {
  const { container } = render(
    <Markdown
      source={[
        '## Summary',
        '',
        'Here is **bold** and *italic* and `code`.',
        '',
        '- first',
        '- second',
        '',
        '```sql',
        'SELECT 1;',
        '```',
      ].join('\n')}
    />,
  );
  expect(screen.getByText('Summary')).toBeInTheDocument();
  expect(container.querySelector('strong')).toHaveTextContent('bold');
  expect(container.querySelector('em')).toHaveTextContent('italic');
  expect(container.querySelectorAll('li')).toHaveLength(2);
  expect(container.querySelector('pre code')).toHaveTextContent('SELECT 1;');
});

test('renders safe links and keeps them relative', () => {
  const { container } = render(
    <Markdown source="Open [the dashboard](/superset/dashboard/42/) now." />,
  );
  const link = container.querySelector('a');
  expect(link).toHaveAttribute('href', '/superset/dashboard/42/');
  expect(link).toHaveAttribute('rel', 'noopener noreferrer');
});

test.each([
  'javascript:alert(1)',
  'JAVASCRIPT:alert(1)',
  'javascript:alert(1)',
  'data:text/html,<script>x</script>',
  'vbscript:evil',
])('refuses unsafe link scheme %s', unsafe => {
  const { container } = render(<Markdown source={`click [here](${unsafe})`} />);
  expect(container.querySelector('a')).toBeNull();
});

test('never injects raw HTML from model output', () => {
  const { container } = render(
    <Markdown source={'<img src=x onerror=alert(1)> and <script>x</script>'} />,
  );
  expect(container.querySelector('img')).toBeNull();
  expect(container.querySelector('script')).toBeNull();
  // The markup renders as inert text instead.
  expect(container.textContent).toContain('<img src=x onerror=alert(1)>');
});
