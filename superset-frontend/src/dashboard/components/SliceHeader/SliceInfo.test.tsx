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
import SliceInfo from './SliceInfo';

jest.mock('@superset-ui/core/components/SafeMarkdown/SafeMarkdown', () => ({
  SafeMarkdown: ({ source }: { source: string }) => (
    <div data-test="safe-markdown">{source}</div>
  ),
}));

const setup = (description = 'Default description') =>
  render(<SliceInfo slice={{ description }} />);

test('Should render chart description', () => {
  setup('Hello world');
  expect(screen.getByTestId('safe-markdown')).toHaveTextContent('Hello world');
});

test('Should pass markdown source to SafeMarkdown', () => {
  const markdown = [
    '# Chart overview',
    '',
    'This chart shows **revenue** by region.',
    '',
    '- North',
    '- South',
    '',
    '[Learn more](https://superset.apache.org)',
  ].join('\n');

  setup(markdown);
  expect(screen.getByTestId('safe-markdown').textContent).toBe(markdown);
});

test('Should render long markdown description without crashing', () => {
  const longMarkdown = `# Summary\n\n${'Long description paragraph. '.repeat(100)}`;

  setup(longMarkdown);
  const content = screen.getByTestId('safe-markdown').textContent ?? '';
  expect(content).toContain('# Summary');
  expect(content.match(/Long description paragraph\./g)).toHaveLength(100);
});

test('Should render empty description without crashing', () => {
  setup('');
  expect(screen.getByTestId('safe-markdown')).toBeEmptyDOMElement();
});
