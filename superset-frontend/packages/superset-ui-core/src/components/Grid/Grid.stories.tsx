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
import { Meta, StoryObj } from '@storybook/react';
import Slider from '@superset-ui/core/components/Slider/index';
import { useState } from 'react';
import { Row, Col } from '.';
import type { ColProps, RowProps } from './types';

export default {
  title: 'Design System/Components/Grid',
  component: Row,
  subcomponents: { Col },
  argTypes: {
    // Row properties
    align: {
      control: 'select',
      options: ['top', 'middle', 'bottom', 'stretch'],
      description: 'Vertical alignment of flex items.',
      defaultValue: 'top',
      table: {
        category: 'Row',
        type: { summary: 'string' },
        defaultValue: { summary: 'top' },
      },
    },
    justify: {
      control: 'select',
      options: [
        'start',
        'end',
        'center',
        'space-around',
        'space-between',
        'space-evenly',
      ],
      description: 'Horizontal arrangement of flex items.',
      defaultValue: undefined,
      table: {
        category: 'Row',
        type: { summary: 'string' },
        defaultValue: { summary: 'start' },
      },
    },
    gutter: {
      control: false,
      description: 'Spacing between grids (horizontal and vertical).',
      defaultValue: 0,
      table: {
        category: 'Row',
        type: { summary: 'number | object | array' },
        defaultValue: { summary: '0' },
      },
    },
    wrap: {
      control: 'boolean',
      description: 'Whether the flex container is allowed to wrap its items.',
      defaultValue: true,
      table: {
        category: 'Row',
        type: { summary: 'boolean' },
        defaultValue: { summary: 'true' },
      },
    },
    // Col properties
    span: {
      control: 'number',
      description: 'Number of grid columns to span.',
      defaultValue: 24,
      table: {
        category: 'Col',
        type: { summary: 'number' },
        defaultValue: { summary: 24 },
      },
    },
    offset: {
      control: 'number',
      description: 'Number of grid columns to offset from the left.',
      defaultValue: 0,
      table: {
        category: 'Col',
        type: { summary: 'number' },
        defaultValue: { summary: 0 },
      },
    },
    order: {
      control: 'number',
      description: 'Flex order style of the grid column.',
      defaultValue: 0,
      table: {
        category: 'Col',
        type: { summary: 'number' },
        defaultValue: { summary: 0 },
      },
    },
    pull: {
      control: 'number',
      description: 'Number of grid columns to pull to the left.',
      defaultValue: 0,
      table: {
        category: 'Col',
        type: { summary: 'number' },
        defaultValue: { summary: 0 },
      },
    },
    push: {
      control: 'number',
      description: 'Number of grid columns to push to the right.',
      defaultValue: 0,
      table: {
        category: 'Col',
        type: { summary: 'number' },
        defaultValue: { summary: 0 },
      },
    },
    flex: {
      control: 'text',
      description: 'Flex layout style for the column.',
      table: {
        category: 'Col',
        type: { summary: 'string | number' },
      },
    },
    // Responsive properties (xs, sm, md, etc.)
    xs: {
      control: 'number',
      description:
        'Settings for extra small screens (< 576px). Can be a number (span) or object.',
      table: {
        category: 'Col',
        type: { summary: 'number | object' },
      },
    },
    sm: {
      control: 'number',
      description:
        'Settings for small screens (≥ 576px). Can be a number (span) or object.',
      table: {
        category: 'Col',
        type: { summary: 'number | object' },
      },
    },
    md: {
      control: 'number',
      description:
        'Settings for medium screens (≥ 768px). Can be a number (span) or object.',
      table: {
        category: 'Col',
        type: { summary: 'number | object' },
      },
    },
    lg: {
      control: 'number',
      description:
        'Settings for large screens (≥ 992px). Can be a number (span) or object.',
      table: {
        category: 'Col',
        type: { summary: 'number | object' },
      },
    },
    xl: {
      control: 'number',
      description:
        'Settings for extra-large screens (≥ 1200px). Can be a number (span) or object.',
      table: {
        category: 'Col',
        type: { summary: 'number | object' },
      },
    },
    xxl: {
      control: 'number',
      description:
        'Settings for extra-extra-large screens (≥ 1600px). Can be a number (span) or object.',
      table: {
        category: 'Col',
        type: { summary: 'number | object' },
      },
    },
  },
  parameters: {
    docs: {
      description: {
        component:
          'The Grid system of Ant Design is based on a 24-grid layout. The `Row` and `Col` components are used to create flexible and responsive grid layouts.',
      },
    },
  },
} as Meta<typeof Row>;

type Story = StoryObj<typeof Row>;

export const GridStory: Story = {
  render: ({ align, justify, wrap, ...rest }: RowProps & ColProps) => {
    const [gutter, setGutter] = useState(24);
    const [vgutter, setVgutter] = useState(24);
    const [colCount, setColCount] = useState(4);
    const rowProps = { align, justify, wrap }; // Props for Row
    const colProps = rest; // Props for Col

    const cols = Array.from({ length: colCount }, (_, i) => (
      <Col
        key={i}
        style={{
          background: '#ddd',
          padding: '8px',
        }}
        {...colProps}
      >
        Column {i + 1}
      </Col>
    ));

    return (
      <div style={{ padding: '20px' }}>
        <div style={{ marginBottom: '16px' }}>
          <span>Horizontal Gutter: </span>
          <Slider
            min={8}
            max={48}
            step={8}
            value={gutter}
            onChange={setGutter}
          />
        </div>
        <div style={{ marginBottom: '16px' }}>
          <span>Vertical Gutter: </span>
          <Slider
            min={8}
            max={48}
            step={8}
            value={vgutter}
            onChange={setVgutter}
          />
        </div>
        <div style={{ marginBottom: '16px' }}>
          <span>Column Count: </span>
          <Slider
            min={2}
            max={12}
            step={1}
            value={colCount}
            onChange={setColCount}
          />
        </div>
        <Row gutter={[gutter, vgutter]} {...rowProps}>
          {cols}
        </Row>
      </div>
    );
  },
};
