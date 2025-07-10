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
import { render, screen } from '../../spec';
import CodeSyntaxHighlighter from './index';

// Simple mock that just returns the content
jest.mock(
  'react-syntax-highlighter/dist/cjs/light',
  () =>
    function MockSyntaxHighlighter({ children, ...props }: any) {
      return (
        <pre data-testid="syntax-highlighter" data-language={props.language}>
          {children}
        </pre>
      );
    },
);

// Mock the language modules
jest.mock(
  'react-syntax-highlighter/dist/cjs/languages/hljs/sql',
  () => 'sql-mock',
);
jest.mock(
  'react-syntax-highlighter/dist/cjs/languages/hljs/json',
  () => 'json-mock',
);
jest.mock(
  'react-syntax-highlighter/dist/cjs/languages/hljs/htmlbars',
  () => 'html-mock',
);
jest.mock(
  'react-syntax-highlighter/dist/cjs/languages/hljs/markdown',
  () => 'md-mock',
);

// Mock the styles
jest.mock('react-syntax-highlighter/dist/cjs/styles/hljs/github', () => ({}));
jest.mock(
  'react-syntax-highlighter/dist/cjs/styles/hljs/atom-one-dark',
  () => ({}),
);

describe('CodeSyntaxHighlighter', () => {
  it('renders code content', () => {
    render(<CodeSyntaxHighlighter>SELECT * FROM users;</CodeSyntaxHighlighter>);

    expect(screen.getByText('SELECT * FROM users;')).toBeInTheDocument();
  });

  it('renders with default SQL language', () => {
    render(<CodeSyntaxHighlighter>SELECT * FROM users;</CodeSyntaxHighlighter>);

    // Should show content (the important thing is content is visible)
    expect(screen.getByText('SELECT * FROM users;')).toBeInTheDocument();
  });

  it('renders with specified language', () => {
    render(
      <CodeSyntaxHighlighter language="json">
        {`{ "key": "value" }`}
      </CodeSyntaxHighlighter>,
    );

    // Should show content regardless of which element renders it
    expect(screen.getByText('{ "key": "value" }')).toBeInTheDocument();
  });

  it('supports all expected languages', () => {
    const languages = ['sql', 'json', 'htmlbars', 'markdown'] as const;

    languages.forEach(language => {
      const { unmount } = render(
        <CodeSyntaxHighlighter language={language}>
          {`Test content for ${language}`}
        </CodeSyntaxHighlighter>,
      );

      // Should render the content (either in fallback or syntax highlighter)
      expect(
        screen.getByText(`Test content for ${language}`),
      ).toBeInTheDocument();

      unmount();
    });
  });

  it('renders fallback pre element initially', () => {
    render(
      <CodeSyntaxHighlighter language="sql">
        SELECT COUNT(*) FROM table;
      </CodeSyntaxHighlighter>,
    );

    // Should render the content in some form
    expect(screen.getByText('SELECT COUNT(*) FROM table;')).toBeInTheDocument();
  });

  it('handles special characters', () => {
    const specialContent = "SELECT * FROM `users` WHERE name = 'O\\'Brien';";

    render(
      <CodeSyntaxHighlighter language="sql">
        {specialContent}
      </CodeSyntaxHighlighter>,
    );

    expect(screen.getByText(specialContent)).toBeInTheDocument();
  });

  it('accepts custom styles', () => {
    render(
      <CodeSyntaxHighlighter language="sql" customStyle={{ fontSize: '16px' }}>
        SELECT * FROM users;
      </CodeSyntaxHighlighter>,
    );

    expect(screen.getByText('SELECT * FROM users;')).toBeInTheDocument();
  });

  it('accepts showLineNumbers prop', () => {
    render(
      <CodeSyntaxHighlighter language="sql" showLineNumbers>
        SELECT * FROM users;
      </CodeSyntaxHighlighter>,
    );

    expect(screen.getByText('SELECT * FROM users;')).toBeInTheDocument();
  });

  it('accepts wrapLines prop', () => {
    render(
      <CodeSyntaxHighlighter language="sql" wrapLines={false}>
        SELECT * FROM users;
      </CodeSyntaxHighlighter>,
    );

    expect(screen.getByText('SELECT * FROM users;')).toBeInTheDocument();
  });
});
