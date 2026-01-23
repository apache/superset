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
import type { Meta, StoryObj } from '@storybook/react';
import { Typography } from '.';

export default {
  title: 'Components/Typography',
  component: Typography,
  subcomponents: {
    Text: Typography.Text,
    Title: Typography.Title,
    Paragraph: Typography.Paragraph,
    Link: Typography.Link,
  },
  parameters: {
    docs: {
      description: {
        component:
          'Typography is a component for displaying text with various styles and formats. It includes subcomponents like Title, Paragraph, and Link.',
      },
    },
  },
} as Meta<
  typeof Typography.Text &
    typeof Typography.Paragraph &
    typeof Typography.Link &
    typeof Typography.Title
>;

type TextStory = StoryObj<typeof Typography.Text>;

export const InteractiveTypography: TextStory = {
  args: {
    children: 'Sample Text',
    code: false,
    copyable: false,
    delete: false,
    disabled: false,
    ellipsis: false,
    keyboard: false,
    mark: false,
    italic: false,
    underline: false,
    strong: false,
    type: undefined,
  },
  argTypes: {
    children: {
      control: 'text',
      description: 'The text content.',
    },
    code: {
      control: 'boolean',
      description: 'Code style.',
    },
    copyable: {
      control: 'boolean',
      description: 'Whether the text is copyable.',
    },
    delete: {
      control: 'boolean',
      description: 'Deleted line style.',
    },
    disabled: {
      control: 'boolean',
      description: 'Disabled content.',
    },
    ellipsis: {
      control: 'boolean',
      description: 'Display ellipsis when text overflows.',
    },
    keyboard: {
      control: 'boolean',
      description: 'Keyboard style.',
    },
    mark: {
      control: 'boolean',
      description: 'Marked/highlighted style.',
    },
    italic: {
      control: 'boolean',
      description: 'Italic style.',
    },
    underline: {
      control: 'boolean',
      description: 'Underlined style.',
    },
    strong: {
      control: 'boolean',
      description: 'Bold style.',
    },
    type: {
      control: 'select',
      options: [undefined, 'secondary', 'success', 'warning', 'danger'],
      description: 'Text type for semantic coloring.',
    },
  },
  render: args => <Typography.Text {...args} />,
};

InteractiveTypography.parameters = {
  docs: {
    description: {
      story: 'Text component with various styling options.',
    },
    liveExample: `function Demo() {
  return (
    <div>
      <Typography.Text>Default Text</Typography.Text>
      <br />
      <Typography.Text type="secondary">Secondary</Typography.Text>
      <br />
      <Typography.Text type="success">Success</Typography.Text>
      <br />
      <Typography.Text type="warning">Warning</Typography.Text>
      <br />
      <Typography.Text type="danger">Danger</Typography.Text>
      <br />
      <Typography.Text code>Code</Typography.Text>
      <br />
      <Typography.Text keyboard>Keyboard</Typography.Text>
      <br />
      <Typography.Text mark>Marked</Typography.Text>
      <br />
      <Typography.Text underline>Underline</Typography.Text>
      <br />
      <Typography.Text delete>Deleted</Typography.Text>
      <br />
      <Typography.Text strong>Strong</Typography.Text>
      <br />
      <Typography.Text italic>Italic</Typography.Text>
    </div>
  );
}`,
    examples: [
      {
        title: 'All Subcomponents',
        code: `function AllSubcomponents() {
  return (
    <div>
      <Typography.Title level={2}>Typography Components</Typography.Title>
      <Typography.Paragraph>
        The Typography component includes several subcomponents for different text needs.
        Use <Typography.Text strong>Title</Typography.Text> for headings,
        <Typography.Text code>Text</Typography.Text> for inline text styling,
        and <Typography.Text mark>Paragraph</Typography.Text> for block content.
      </Typography.Paragraph>
      <Typography.Link href="https://superset.apache.org" target="_blank">
        Learn more about Apache Superset
      </Typography.Link>
    </div>
  );
}`,
      },
      {
        title: 'Text Styling Options',
        code: `function TextStyles() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Typography.Text code>Code style</Typography.Text>
      <Typography.Text keyboard>Keyboard style</Typography.Text>
      <Typography.Text mark>Highlighted text</Typography.Text>
      <Typography.Text underline>Underlined text</Typography.Text>
      <Typography.Text delete>Deleted text</Typography.Text>
      <Typography.Text strong>Bold text</Typography.Text>
      <Typography.Text italic>Italic text</Typography.Text>
      <Typography.Text type="success">Success type</Typography.Text>
      <Typography.Text type="warning">Warning type</Typography.Text>
      <Typography.Text type="danger">Danger type</Typography.Text>
    </div>
  );
}`,
      },
    ],
  },
};

// Keep original for backwards compatibility
export const TextStory: TextStory = {
  args: {
    children: 'Default Text',
  },
  render: args => <Typography.Text {...args} />,
};

type TitleStory = StoryObj<typeof Typography.Title>;

export const InteractiveTitle: TitleStory = {
  args: {
    children: 'Sample Title',
    level: 1,
    copyable: false,
    delete: false,
    disabled: false,
    ellipsis: false,
    mark: false,
    italic: false,
    underline: false,
    type: undefined,
  },
  argTypes: {
    children: {
      control: 'text',
      description: 'The title content.',
    },
    level: {
      control: { type: 'number', min: 1, max: 5 },
      description: 'Set content importance (h1-h5).',
    },
    copyable: {
      control: 'boolean',
      description: 'Whether the title is copyable.',
    },
    delete: {
      control: 'boolean',
      description: 'Deleted line style.',
    },
    disabled: {
      control: 'boolean',
      description: 'Disabled content.',
    },
    ellipsis: {
      control: 'boolean',
      description: 'Display ellipsis when text overflows.',
    },
    mark: {
      control: 'boolean',
      description: 'Marked/highlighted style.',
    },
    italic: {
      control: 'boolean',
      description: 'Italic style.',
    },
    underline: {
      control: 'boolean',
      description: 'Underlined style.',
    },
    type: {
      control: 'select',
      options: [undefined, 'secondary', 'success', 'warning', 'danger'],
      description: 'Title type for semantic coloring.',
    },
  },
  render: args => <Typography.Title {...args} />,
  parameters: {
    docs: {
      description: {
        story: 'Title component with heading levels h1-h5.',
      },
      liveExample: `function Demo() {
  return (
    <div>
      <Typography.Title level={1}>h1. Heading</Typography.Title>
      <Typography.Title level={2}>h2. Heading</Typography.Title>
      <Typography.Title level={3}>h3. Heading</Typography.Title>
      <Typography.Title level={4}>h4. Heading</Typography.Title>
      <Typography.Title level={5}>h5. Heading</Typography.Title>
    </div>
  );
}`,
    },
  },
};

export const TitleStory: TitleStory = {
  args: {
    children: 'Default Title',
  },
  render: args => <Typography.Title {...args} />,
};

type ParagraphStory = StoryObj<typeof Typography.Paragraph>;

export const InteractiveParagraph: ParagraphStory = {
  args: {
    children:
      'This is a paragraph of text. Paragraphs are block-level elements that support various text styling options.',
    copyable: false,
    delete: false,
    disabled: false,
    ellipsis: false,
    mark: false,
    strong: false,
    italic: false,
    underline: false,
    type: undefined,
  },
  argTypes: {
    children: {
      control: 'text',
      description: 'The paragraph content.',
    },
    copyable: {
      control: 'boolean',
      description: 'Whether the paragraph is copyable.',
    },
    delete: {
      control: 'boolean',
      description: 'Deleted line style.',
    },
    disabled: {
      control: 'boolean',
      description: 'Disabled content.',
    },
    ellipsis: {
      control: 'boolean',
      description: 'Display ellipsis when text overflows.',
    },
    mark: {
      control: 'boolean',
      description: 'Marked/highlighted style.',
    },
    strong: {
      control: 'boolean',
      description: 'Bold style.',
    },
    italic: {
      control: 'boolean',
      description: 'Italic style.',
    },
    underline: {
      control: 'boolean',
      description: 'Underlined style.',
    },
    type: {
      control: 'select',
      options: [undefined, 'secondary', 'success', 'warning', 'danger'],
      description: 'Paragraph type for semantic coloring.',
    },
  },
  render: args => <Typography.Paragraph {...args} />,
  parameters: {
    docs: {
      description: {
        story: 'Paragraph component for block-level text content.',
      },
      liveExample: `function Demo() {
  return (
    <Typography.Paragraph>
      This is a paragraph. Paragraphs are used for block-level text content.
      They support features like <Typography.Text strong>bold</Typography.Text>,
      <Typography.Text italic> italic</Typography.Text>, and
      <Typography.Text code> code</Typography.Text> styling.
    </Typography.Paragraph>
  );
}`,
    },
  },
};

export const ParagraphStory: ParagraphStory = {
  args: {
    children: 'Default Paragraph',
  },
  render: args => <Typography.Paragraph {...args} />,
};

type LinkStory = StoryObj<typeof Typography.Link>;

export const InteractiveLink: LinkStory = {
  args: {
    children: 'Click here',
    href: 'https://superset.apache.org',
    target: '_blank',
    copyable: false,
    delete: false,
    disabled: false,
    ellipsis: false,
    mark: false,
    strong: false,
    italic: false,
    underline: false,
    type: undefined,
  },
  argTypes: {
    children: {
      control: 'text',
      description: 'The link text.',
    },
    href: {
      control: 'text',
      description: 'The URL the link points to.',
    },
    target: {
      control: 'select',
      options: ['_blank', '_self', '_parent', '_top'],
      description: 'Where to open the linked document.',
    },
    copyable: {
      control: 'boolean',
      description: 'Whether the link is copyable.',
    },
    delete: {
      control: 'boolean',
      description: 'Deleted line style.',
    },
    disabled: {
      control: 'boolean',
      description: 'Disabled link.',
    },
    ellipsis: {
      control: 'boolean',
      description: 'Display ellipsis when text overflows.',
    },
    mark: {
      control: 'boolean',
      description: 'Marked/highlighted style.',
    },
    strong: {
      control: 'boolean',
      description: 'Bold style.',
    },
    italic: {
      control: 'boolean',
      description: 'Italic style.',
    },
    underline: {
      control: 'boolean',
      description: 'Underlined style.',
    },
    type: {
      control: 'select',
      options: [undefined, 'secondary', 'success', 'warning', 'danger'],
      description: 'Link type for semantic coloring.',
    },
  },
  render: args => <Typography.Link {...args} />,
  parameters: {
    docs: {
      description: {
        story: 'Link component for hyperlinks with text styling options.',
      },
      liveExample: `function Demo() {
  return (
    <div>
      <Typography.Link href="https://superset.apache.org" target="_blank">
        Apache Superset
      </Typography.Link>
    </div>
  );
}`,
    },
  },
};

export const LinkStory: LinkStory = {
  args: {
    children: 'Default Link',
    href: 'https://example.com',
    target: '_blank',
  },
  render: args => <Typography.Link {...args} />,
};
