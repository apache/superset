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

export const InteractiveGrid: Story = {
  args: {
    align: 'top',
    justify: 'start',
    wrap: true,
    span: 6,
    offset: 0,
  },
  argTypes: {
    align: {
      control: 'select',
      options: ['top', 'middle', 'bottom', 'stretch'],
      description: 'Vertical alignment of flex items.',
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
    },
    wrap: {
      control: 'boolean',
      description: 'Whether the flex container is allowed to wrap its items.',
    },
    span: {
      control: 'number',
      description: 'Number of grid columns to span (out of 24).',
    },
    offset: {
      control: 'number',
      description: 'Number of grid columns to offset from the left.',
    },
  },
  render: ({ align, justify, wrap, ...rest }: RowProps & ColProps) => {
    const [gutter, setGutter] = useState(24);
    const [vgutter, setVgutter] = useState(24);
    const [colCount, setColCount] = useState(4);
    const rowProps = { align, justify, wrap };
    const colProps = rest;

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
  parameters: {
    docs: {
      description: {
        story:
          'Grid layout system based on 24 columns with configurable gutters.',
      },
      liveExample: `function Demo() {
  return (
    <Row gutter={[16, 16]}>
      <Col span={12}>
        <div style={{ background: '#ddd', padding: '8px' }}>col-12</div>
      </Col>
      <Col span={12}>
        <div style={{ background: '#ddd', padding: '8px' }}>col-12</div>
      </Col>
      <Col span={8}>
        <div style={{ background: '#ddd', padding: '8px' }}>col-8</div>
      </Col>
      <Col span={8}>
        <div style={{ background: '#ddd', padding: '8px' }}>col-8</div>
      </Col>
      <Col span={8}>
        <div style={{ background: '#ddd', padding: '8px' }}>col-8</div>
      </Col>
    </Row>
  );
}`,
    },
  },
};

// Keep original for backwards compatibility
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
