/*
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
import { Meta, StoryFn } from '@storybook/react';
import { SafeMarkdown } from './SafeMarkdown';

export default {
  title: 'Components/SafeMarkdown',
  component: SafeMarkdown,
} as Meta<typeof SafeMarkdown>;

interface SafeMarkdownArgs {
  source: string;
  htmlSanitization?: boolean;
}

// Interactive SafeMarkdown story
export const InteractiveSafeMarkdown: StoryFn<SafeMarkdownArgs> = args => (
  <SafeMarkdown {...args} />
);

InteractiveSafeMarkdown.args = {
  source: `# Hello Markdown!

This is a **bold** statement and this is *italic*.

## Features

- Bullet point 1
- Bullet point 2
- Bullet point 3

### Code Example

\`\`\`javascript
const greeting = "Hello, World!";
console.log(greeting);
\`\`\`

Inline \`code\` works too!

> This is a blockquote for important notes.

| Column 1 | Column 2 | Column 3 |
|----------|----------|----------|
| Row 1    | Data     | More     |
| Row 2    | Data     | More     |

[Link to Apache Superset](https://superset.apache.org)
`,
  htmlSanitization: true,
};

InteractiveSafeMarkdown.argTypes = {
  source: {
    description: 'Markdown source string to render',
    control: { type: 'text' },
  },
  htmlSanitization: {
    description: 'Enable HTML sanitization (recommended for user input)',
    control: { type: 'boolean' },
  },
};

// GitHub Flavored Markdown examples
export const GFMFeatures: StoryFn = () => (
  <SafeMarkdown
    source={`## GitHub Flavored Markdown

### Task Lists

- [x] Completed task
- [ ] Incomplete task
- [ ] Another task

### Strikethrough

~~This text is struck through~~

### Tables

| Feature | Supported |
|---------|-----------|
| Tables | ✅ |
| Task Lists | ✅ |
| Strikethrough | ✅ |
| Autolinks | ✅ |

### Autolinks

Visit https://superset.apache.org for more info.

### Footnotes

Here is a footnote reference[^1].

[^1]: Here is the footnote content.
`}
  />
);

GFMFeatures.parameters = {
  docs: {
    description: {
      story:
        'Demonstrates GitHub Flavored Markdown (GFM) features like task lists, strikethrough, tables, and autolinks.',
    },
  },
};

// HTML sanitization comparison
export const HTMLSanitization: StoryFn = () => (
  <div style={{ display: 'flex', gap: 40 }}>
    <div style={{ flex: 1 }}>
      <h4>With Sanitization (default)</h4>
      <div style={{ border: '1px solid #ddd', padding: 16, borderRadius: 4 }}>
        <SafeMarkdown
          source={`
### Safe HTML

<div>This div is allowed</div>
<span style="color: red;">Inline styles are stripped</span>
<script>alert('This script is removed')</script>
<img src="x" onerror="alert('XSS')">
<a href="javascript:alert('XSS')">Malicious link</a>
<a href="https://superset.apache.org">Safe link</a>
          `}
          htmlSanitization
        />
      </div>
    </div>
    <div style={{ flex: 1 }}>
      <h4>Without Sanitization</h4>
      <div style={{ border: '1px solid #ddd', padding: 16, borderRadius: 4 }}>
        <SafeMarkdown
          source={`
### Unsanitized HTML

<div style="color: blue; font-weight: bold;">Styled div works</div>
<span style="background: yellow; padding: 4px;">Inline styles preserved</span>
          `}
          htmlSanitization={false}
        />
      </div>
    </div>
  </div>
);

HTMLSanitization.parameters = {
  docs: {
    description: {
      story:
        'Compares rendering with and without HTML sanitization. Sanitization removes potentially dangerous elements like scripts and event handlers.',
    },
  },
};

// Common dashboard use cases
export const DashboardUseCases: StoryFn = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
    <div>
      <h4>Chart Description</h4>
      <div
        style={{
          border: '1px solid #ddd',
          padding: 16,
          borderRadius: 4,
          background: '#fafafa',
        }}
      >
        <SafeMarkdown
          source={`### Monthly Revenue Analysis

This chart shows **revenue trends** over the past 12 months.

Key insights:
- Q4 shows *significant growth* (+25%)
- Summer months historically slower
- Year-over-year improvement of **18%**

_Data source: Finance Department_`}
        />
      </div>
    </div>

    <div>
      <h4>Data Quality Notes</h4>
      <div
        style={{
          border: '1px solid #ddd',
          padding: 16,
          borderRadius: 4,
          background: '#fff3cd',
        }}
      >
        <SafeMarkdown
          source={`> ⚠️ **Data Quality Notice**
>
> Some records from the legacy system may be incomplete.
> See [data dictionary](/docs/data-dictionary) for details.`}
        />
      </div>
    </div>

    <div>
      <h4>Metric Definitions</h4>
      <div
        style={{
          border: '1px solid #ddd',
          padding: 16,
          borderRadius: 4,
          background: '#fafafa',
        }}
      >
        <SafeMarkdown
          source={`| Metric | Definition | Formula |
|--------|------------|---------|
| **CAC** | Customer Acquisition Cost | \`total_marketing_spend / new_customers\` |
| **LTV** | Lifetime Value | \`avg_revenue_per_customer * avg_customer_lifespan\` |
| **Churn** | Monthly Churn Rate | \`lost_customers / start_customers * 100\` |`}
        />
      </div>
    </div>
  </div>
);

DashboardUseCases.parameters = {
  docs: {
    description: {
      story:
        'Real-world examples of how SafeMarkdown is used in Superset dashboards for chart descriptions, data quality notes, and metric definitions.',
    },
  },
};
