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
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { EmojiTextArea, type EmojiItem } from '.';

const meta: Meta<typeof EmojiTextArea> = {
  title: 'Components/EmojiTextArea',
  component: EmojiTextArea,
  parameters: {
    docs: {
      description: {
        component: `
A TextArea component with Slack-like emoji autocomplete.

## Features

- **Colon prefix trigger**: Type \`:sm\` to see smile emoji suggestions
- **Minimum 2 characters**: Popup only shows after typing 2+ characters (configurable)
- **Smart trigger detection**: Colon must be preceded by whitespace, start of line, or another emoji
- **Prevents accidental selection**: Quick Enter keypress creates newline instead of selecting

## Usage

\`\`\`tsx
import { EmojiTextArea } from '@superset-ui/core/components';

<EmojiTextArea
  placeholder="Type :smile: to add emojis..."
  onChange={(text) => console.log(text)}
  onEmojiSelect={(emoji) => console.log('Selected:', emoji)}
/>
\`\`\`

## Trigger Behavior (Slack-like)

The emoji picker triggers in these scenarios:
- \`:sm\` - at the start of text
- \`hello :sm\` - after a space
- \`😀:sm\` - after another emoji

It does NOT trigger in:
- \`hello:sm\` - no space before colon
- \`http://example.com\` - colon preceded by letter

Try it out below!
        `,
      },
    },
  },
  argTypes: {
    minCharsBeforePopup: {
      control: { type: 'number', min: 1, max: 5 },
      description: 'Minimum characters after colon before showing popup',
      defaultValue: 2,
    },
    maxSuggestions: {
      control: { type: 'number', min: 1, max: 20 },
      description: 'Maximum number of emoji suggestions to show',
      defaultValue: 10,
    },
    placeholder: {
      control: 'text',
      description: 'Placeholder text',
    },
    rows: {
      control: { type: 'number', min: 1, max: 20 },
      description: 'Number of visible rows',
    },
  },
};

export default meta;
type Story = StoryObj<typeof EmojiTextArea>;

export const Default: Story = {
  args: {
    placeholder: 'Type :smile: or :thumbsup: to add emojis...',
    rows: 4,
    style: { width: '100%', maxWidth: 500 },
  },
};

export const WithMinChars: Story = {
  args: {
    ...Default.args,
    minCharsBeforePopup: 3,
    placeholder: 'Requires 3 characters after colon (e.g., :smi)',
  },
};

export const WithMaxSuggestions: Story = {
  args: {
    ...Default.args,
    maxSuggestions: 5,
    placeholder: 'Shows max 5 suggestions',
  },
};

export const Controlled: Story = {
  render: function ControlledStory() {
    const [value, setValue] = useState('');
    const [selectedEmojis, setSelectedEmojis] = useState<EmojiItem[]>([]);

    return (
      <div style={{ maxWidth: 500 }}>
        <EmojiTextArea
          value={value}
          onChange={setValue}
          onEmojiSelect={emoji => setSelectedEmojis(prev => [...prev, emoji])}
          placeholder="Type :smile: or :heart: to add emojis..."
          rows={4}
          style={{ width: '100%' }}
        />
        <div style={{ marginTop: 16 }}>
          <strong>Current value:</strong>
          <pre
            style={{
              background: 'var(--ant-color-bg-container)',
              padding: 8,
              borderRadius: 4,
              border: '1px solid var(--ant-color-border)',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {value || '(empty)'}
          </pre>
        </div>
        {selectedEmojis.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <strong>Selected emojis:</strong>
            <div style={{ fontSize: 24, marginTop: 8 }}>
              {selectedEmojis.map((e, i) => (
                <span key={i} title={`:${e.shortcode}:`}>
                  {e.emoji}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  },
};

export const SlackBehaviorDemo: Story = {
  render: function SlackBehaviorDemoStory() {
    const examples = [
      { input: ':sm', works: true, desc: 'Start of text' },
      { input: 'hello :sm', works: true, desc: 'After space' },
      {
        input: '😀:sm',
        works: true,
        desc: 'After emoji',
        needsEmoji: true,
      },
      { input: 'hello:sm', works: false, desc: 'No space before colon' },
      { input: ':s', works: false, desc: 'Only 1 character' },
    ];

    return (
      <div style={{ maxWidth: 600 }}>
        <h3>Slack-like Trigger Behavior</h3>
        <p style={{ color: 'var(--ant-color-text-secondary)' }}>
          The emoji picker mimics Slack&apos;s behavior. Try these examples:
        </p>

        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            marginBottom: 24,
          }}
        >
          <thead>
            <tr>
              <th
                style={{
                  textAlign: 'left',
                  padding: 8,
                  borderBottom: '1px solid var(--ant-color-border)',
                }}
              >
                Input
              </th>
              <th
                style={{
                  textAlign: 'left',
                  padding: 8,
                  borderBottom: '1px solid var(--ant-color-border)',
                }}
              >
                Shows Popup?
              </th>
              <th
                style={{
                  textAlign: 'left',
                  padding: 8,
                  borderBottom: '1px solid var(--ant-color-border)',
                }}
              >
                Reason
              </th>
            </tr>
          </thead>
          <tbody>
            {examples.map((ex, i) => (
              <tr key={i}>
                <td
                  style={{
                    padding: 8,
                    borderBottom: '1px solid var(--ant-color-border)',
                    fontFamily: 'monospace',
                  }}
                >
                  {ex.input}
                </td>
                <td
                  style={{
                    padding: 8,
                    borderBottom: '1px solid var(--ant-color-border)',
                  }}
                >
                  {ex.works ? '✅ Yes' : '❌ No'}
                </td>
                <td
                  style={{
                    padding: 8,
                    borderBottom: '1px solid var(--ant-color-border)',
                  }}
                >
                  {ex.desc}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <EmojiTextArea
          placeholder="Try the examples above..."
          rows={4}
          style={{ width: '100%' }}
        />
      </div>
    );
  },
};

export const InForm: Story = {
  render: function InFormStory() {
    const [description, setDescription] = useState('');
    const [title, setTitle] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      // eslint-disable-next-line no-alert
      alert(`Title: ${title}\nDescription: ${description}`);
    };

    return (
      <form onSubmit={handleSubmit} style={{ maxWidth: 500 }}>
        <div style={{ marginBottom: 16 }}>
          <label htmlFor="title" style={{ display: 'block', marginBottom: 4 }}>
            Title
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Enter a title"
            style={{
              width: '100%',
              padding: 8,
              borderRadius: 4,
              border: '1px solid var(--ant-color-border)',
            }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label
            htmlFor="description"
            style={{ display: 'block', marginBottom: 4 }}
          >
            Description (with emoji support)
          </label>
          <EmojiTextArea
            id="description"
            value={description}
            onChange={setDescription}
            placeholder="Add a description... use :smile: for emojis!"
            rows={4}
            style={{ width: '100%' }}
          />
        </div>

        <button
          type="submit"
          style={{
            padding: '8px 16px',
            background: 'var(--ant-color-primary)',
            color: 'white',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
          }}
        >
          Submit
        </button>
      </form>
    );
  },
};
