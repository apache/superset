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
import Slider from 'src/components/Slider/index';
import { useState } from 'react';
import { Row, Col } from './index';

export default {
  title: 'Components/Grid',
  component: Row,
  subcomponents: { Col },
  argTypes: {
    // Row properties
    align: {
      control: 'select',
      options: ['top', 'middle', 'bottom', 'stretch'],
      description: 'Vertical alignment',
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
      description: 'Horizontal arrangement',
    },
    gutter: {
      control: 'object',
      description: 'Spacing between grids',
    },
    wrap: {
      control: 'boolean',
      description: 'Auto wrap line',
    },
    // Col properties
    flex: {
      control: 'text',
      description: 'Flex layout style',
    },
    offset: {
      control: 'number',
      description: 'The number of cells to offset Col from the left',
    },
    order: {
      control: 'number',
      description: 'Raster order',
    },
    pull: {
      control: 'number',
      description: 'The number of cells that raster is moved to the left',
    },
    push: {
      control: 'number',
      description: 'The number of cells that raster is moved to the right',
    },
    span: {
      control: 'number',
      description: 'Raster number of cells to occupy',
    },
    xs: {
      control: 'object',
      description: 'Settings for screen < 576px',
    },
    sm: {
      control: 'object',
      description: 'Settings for screen ≥ 576px',
    },
    md: {
      control: 'object',
      description: 'Settings for screen ≥ 768px',
    },
    lg: {
      control: 'object',
      description: 'Settings for screen ≥ 992px',
    },
    xl: {
      control: 'object',
      description: 'Settings for screen ≥ 1200px',
    },
    xxl: {
      control: 'object',
      description: 'Settings for screen ≥ 1600px',
    },
  },
  parameters: {
    docs: {
      description: {
        component:
          'Grid is a hook, but here we are testing the Row and Col components that use it.',
      },
    },
  },
} as Meta<typeof Row>;

type Story = StoryObj<typeof Row>;

export const GridStory: Story = {
  render: () => {
    const [gutter, setGutter] = useState(24);
    const [vgutter, setVgutter] = useState(24);
    const [colCount, setColCount] = useState(4);

    const cols = Array.from({ length: colCount }, (_, i) => (
      <Col
        key={i}
        span={24 / colCount}
        style={{
          background: '#ddd',
          padding: '8px',
          textAlign: 'center',
        }}
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
        <Row
          gutter={[gutter, vgutter]}
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(auto-fill, minmax(calc(100% / 4 - ${gutter}px), 1fr))`,
            gap: `${vgutter}px ${gutter}px`,
          }}
        >
          {cols}
        </Row>
      </div>
    );
  },
};
