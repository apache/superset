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
    gutter: 16,
  },
  argTypes: {
    align: {
      control: 'select',
      options: ['top', 'middle', 'bottom', 'stretch'],
      description: 'Vertical alignment of columns within the row.',
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
      description: 'Horizontal distribution of columns within the row.',
    },
    wrap: {
      control: 'boolean',
      description: 'Whether columns are allowed to wrap to the next line.',
    },
    gutter: {
      control: 'number',
      description: 'Spacing between columns in pixels.',
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
};

InteractiveGrid.parameters = {
  docs: {
    renderComponent: 'Row',
    sampleChildren: [
      { component: 'Col', props: { span: 4, children: 'col-4', style: { background: '#e6f4ff', padding: '8px', border: '1px solid #91caff', textAlign: 'center' } } },
      { component: 'Col', props: { span: 4, children: 'col-4 (tall)', style: { background: '#e6f4ff', padding: '24px 8px', border: '1px solid #91caff', textAlign: 'center' } } },
      { component: 'Col', props: { span: 4, children: 'col-4', style: { background: '#e6f4ff', padding: '8px', border: '1px solid #91caff', textAlign: 'center' } } },
    ],
    description: {
      story:
        'Grid layout system based on 24 columns with configurable gutters.',
    },
    liveExample: `function Demo() {
  return (
    <Row gutter={[16, 16]}>
      <Col span={12}>
        <div style={{ background: '#e6f4ff', padding: '8px', border: '1px solid #91caff' }}>col-12</div>
      </Col>
      <Col span={12}>
        <div style={{ background: '#e6f4ff', padding: '8px', border: '1px solid #91caff' }}>col-12</div>
      </Col>
      <Col span={8}>
        <div style={{ background: '#e6f4ff', padding: '8px', border: '1px solid #91caff' }}>col-8</div>
      </Col>
      <Col span={8}>
        <div style={{ background: '#e6f4ff', padding: '8px', border: '1px solid #91caff' }}>col-8</div>
      </Col>
      <Col span={8}>
        <div style={{ background: '#e6f4ff', padding: '8px', border: '1px solid #91caff' }}>col-8</div>
      </Col>
    </Row>
  );
}`,
    examples: [
      {
        title: 'Responsive Grid',
        code: `function ResponsiveGrid() {
  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} sm={12} md={8} lg={6}>
        <div style={{ background: '#e6f4ff', padding: '16px', border: '1px solid #91caff', textAlign: 'center' }}>
          Responsive
        </div>
      </Col>
      <Col xs={24} sm={12} md={8} lg={6}>
        <div style={{ background: '#e6f4ff', padding: '16px', border: '1px solid #91caff', textAlign: 'center' }}>
          Responsive
        </div>
      </Col>
      <Col xs={24} sm={12} md={8} lg={6}>
        <div style={{ background: '#e6f4ff', padding: '16px', border: '1px solid #91caff', textAlign: 'center' }}>
          Responsive
        </div>
      </Col>
      <Col xs={24} sm={12} md={8} lg={6}>
        <div style={{ background: '#e6f4ff', padding: '16px', border: '1px solid #91caff', textAlign: 'center' }}>
          Responsive
        </div>
      </Col>
    </Row>
  );
}`,
      },
      {
        title: 'Alignment',
        code: `function AlignmentDemo() {
  const boxStyle = { background: '#e6f4ff', padding: '16px 0', border: '1px solid #91caff', textAlign: 'center' };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Row justify="start" gutter={8}>
        <Col span={4}><div style={boxStyle}>start</div></Col>
        <Col span={4}><div style={boxStyle}>start</div></Col>
      </Row>
      <Row justify="center" gutter={8}>
        <Col span={4}><div style={boxStyle}>center</div></Col>
        <Col span={4}><div style={boxStyle}>center</div></Col>
      </Row>
      <Row justify="end" gutter={8}>
        <Col span={4}><div style={boxStyle}>end</div></Col>
        <Col span={4}><div style={boxStyle}>end</div></Col>
      </Row>
      <Row justify="space-between" gutter={8}>
        <Col span={4}><div style={boxStyle}>between</div></Col>
        <Col span={4}><div style={boxStyle}>between</div></Col>
      </Row>
    </div>
  );
}`,
      },
    ],
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
