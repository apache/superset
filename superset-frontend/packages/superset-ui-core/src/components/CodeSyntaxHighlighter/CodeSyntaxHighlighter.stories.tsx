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
import { Typography, Flex, Space } from '@superset-ui/core/components';
import CodeSyntaxHighlighter from '.';
import type { CodeSyntaxHighlighterProps, SupportedLanguage } from '.';

const { Title, Text, Paragraph } = Typography;

const languages: SupportedLanguage[] = ['sql', 'json', 'htmlbars', 'markdown'];

// Sample code for each language
const sampleCode = {
  sql: `-- Complex SQL Query Example
SELECT
  u.id,
  u.username,
  u.email,
  COUNT(o.id) as total_orders,
  SUM(o.amount) as total_spent,
  AVG(o.amount) as avg_order_value
FROM users u
LEFT JOIN orders o ON u.id = o.user_id
WHERE u.created_at >= '2023-01-01'
  AND u.status = 'active'
GROUP BY u.id, u.username, u.email
HAVING COUNT(o.id) > 0
ORDER BY total_spent DESC, total_orders DESC
LIMIT 50;`,

  json: `{
  "user": {
    "id": 12345,
    "username": "john_doe",
    "email": "john@example.com",
    "profile": {
      "firstName": "John",
      "lastName": "Doe",
      "age": 30,
      "preferences": {
        "theme": "dark",
        "language": "en",
        "notifications": true
      }
    },
    "orders": [
      {
        "id": "order_001",
        "amount": 99.99,
        "status": "completed",
        "items": ["laptop", "mouse"]
      },
      {
        "id": "order_002",
        "amount": 49.99,
        "status": "pending",
        "items": ["keyboard"]
      }
    ]
  }
}`,

  htmlbars: `{{!-- Handlebars Template Example --}}
<div class="user-profile">
  <h1>Welcome, {{user.firstName}} {{user.lastName}}!</h1>

  {{#if user.orders}}
    <div class="orders-section">
      <h2>Your Orders ({{user.orders.length}})</h2>

      {{#each user.orders}}
        <div class="order-card {{status}}">
          <h3>Order #{{id}}</h3>
          <p class="amount">\${{amount}}</p>
          <p class="status">Status: {{capitalize status}}</p>

          {{#if items}}
            <ul class="items">
              {{#each items}}
                <li>{{this}}</li>
              {{/each}}
            </ul>
          {{/if}}
        </div>
      {{/each}}
    </div>
  {{else}}
    <p class="no-orders">No orders found.</p>
  {{/if}}
</div>`,

  markdown: `# CodeSyntaxHighlighter Component

A **themed syntax highlighter** for Superset that supports multiple languages and automatic theme switching.

## Features

- 🎨 **Automatic theming** - Adapts to light/dark modes
- ⚡ **Lazy loading** - Languages load on-demand for better performance
- 🔧 **TypeScript support** - Full type safety
- 📱 **Responsive** - Works on all screen sizes

## Supported Languages

| Language | Extension | Use Case |
|----------|-----------|----------|
| SQL | \`.sql\` | Database queries |
| JSON | \`.json\` | Data interchange |
| HTML/Handlebars | \`.hbs\` | Templates |
| Markdown | \`.md\` | Documentation |

## Usage

\`\`\`typescript
import CodeSyntaxHighlighter from '@superset-ui/core/components/CodeSyntaxHighlighter';

<CodeSyntaxHighlighter language="sql">
  SELECT * FROM users WHERE active = true;
</CodeSyntaxHighlighter>
\`\`\`

> **Note**: Languages are loaded lazily for optimal performance!`,
};

export default {
  title: 'Components/CodeSyntaxHighlighter',
  component: CodeSyntaxHighlighter,
  parameters: {
    docs: {
      description: {
        component:
          "A themed syntax highlighter component that automatically adapts to Superset's light/dark themes and supports lazy loading of languages.",
      },
    },
  },
};

// Gallery showing all supported languages
export const LanguageGallery = () => (
  <Space direction="vertical" size="large" style={{ width: '100%' }}>
    {languages.map(language => (
      <div key={language}>
        <Title
          level={3}
          style={{ textTransform: 'capitalize', marginBottom: 16 }}
        >
          {language.toUpperCase()} Example
        </Title>
        <CodeSyntaxHighlighter language={language}>
          {sampleCode[language]}
        </CodeSyntaxHighlighter>
      </div>
    ))}
  </Space>
);

// Interactive playground
export const InteractivePlayground = (args: CodeSyntaxHighlighterProps) => (
  <CodeSyntaxHighlighter {...args}>
    {args.children || sampleCode[args.language || 'sql']}
  </CodeSyntaxHighlighter>
);

InteractivePlayground.args = {
  language: 'sql',
  showLineNumbers: false,
  wrapLines: true,
  children: sampleCode.sql,
};

InteractivePlayground.argTypes = {
  language: {
    control: { type: 'select' },
    options: languages,
    description: 'Programming language for syntax highlighting',
  },
  showLineNumbers: {
    control: { type: 'boolean' },
    description: 'Display line numbers alongside the code',
  },
  wrapLines: {
    control: { type: 'boolean' },
    description: 'Wrap long lines instead of showing horizontal scroll',
  },
  children: {
    control: { type: 'text' },
    description: 'Code content to highlight',
  },
  customStyle: {
    control: { type: 'object' },
    description: 'Custom CSS styles to apply to the syntax highlighter',
  },
};

// Showcase different styling options
export const StylingExamples = () => (
  <Space direction="vertical" size="large" style={{ width: '100%' }}>
    {/* Default styling */}
    <div>
      <Title level={3}>Default Styling</Title>
      <CodeSyntaxHighlighter language="sql">
        SELECT id, name FROM users WHERE active = true;
      </CodeSyntaxHighlighter>
    </div>

    {/* With line numbers */}
    <div>
      <Title level={3}>With Line Numbers</Title>
      <CodeSyntaxHighlighter language="sql" showLineNumbers>
        {sampleCode.sql}
      </CodeSyntaxHighlighter>
    </div>

    {/* Custom styling */}
    <div>
      <Title level={3}>Custom Styling (Compact)</Title>
      <CodeSyntaxHighlighter
        language="json"
        customStyle={{
          fontSize: '12px',
          padding: '12px',
          maxHeight: '200px',
          overflow: 'auto',
        }}
      >
        {sampleCode.json}
      </CodeSyntaxHighlighter>
    </div>

    {/* No line wrapping */}
    <div>
      <Title level={3}>No Line Wrapping</Title>
      <CodeSyntaxHighlighter
        language="sql"
        wrapLines={false}
        customStyle={{ maxWidth: '400px' }}
      >
        {`SELECT very_long_column_name, another_very_long_column_name, yet_another_extremely_long_column_name FROM very_long_table_name WHERE condition = 'this is a very long condition';`}
      </CodeSyntaxHighlighter>
    </div>
  </Space>
);

// Performance and edge cases
export const EdgeCases = () => (
  <Space direction="vertical" size="large" style={{ width: '100%' }}>
    {/* Very long single line */}
    <div>
      <Title level={3}>Very Long Single Line</Title>
      <CodeSyntaxHighlighter language="sql">
        {`SELECT ${'very_long_column_name, '.repeat(20)}id FROM users;`}
      </CodeSyntaxHighlighter>
    </div>

    {/* Special characters */}
    <div>
      <Title level={3}>Special Characters & Escaping</Title>
      <CodeSyntaxHighlighter language="sql">
        {`SELECT * FROM "table-name" WHERE field = 'O\\'Brien' AND data = '{"key": "value"}';`}
      </CodeSyntaxHighlighter>
    </div>

    {/* Multiple languages showcase */}
    <div>
      <Title level={3}>Quick Language Comparison</Title>
      <Flex gap="middle">
        <div style={{ flex: 1 }}>
          <Title level={4}>SQL</Title>
          <CodeSyntaxHighlighter language="sql">
            SELECT id, name FROM users;
          </CodeSyntaxHighlighter>
        </div>
        <div style={{ flex: 1 }}>
          <Title level={4}>JSON</Title>
          <CodeSyntaxHighlighter language="json">
            {`{"users": [{"id": 1, "name": "John"}]}`}
          </CodeSyntaxHighlighter>
        </div>
      </Flex>
    </div>
  </Space>
);

// Theme testing helper
export const ThemeShowcase = () => (
  <Space direction="vertical" size="middle" style={{ width: '100%' }}>
    <Paragraph>
      <Text strong>Theme Testing:</Text> Switch between light and dark themes in
      Storybook to see automatic adaptation.
    </Paragraph>

    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      {languages.map(language => (
        <div key={language}>
          <Title level={4} style={{ textTransform: 'uppercase' }}>
            {language}
          </Title>
          <CodeSyntaxHighlighter language={language}>
            {sampleCode[language].split('\n').slice(0, 5).join('\n')}
          </CodeSyntaxHighlighter>
        </div>
      ))}
    </Space>
  </Space>
);
