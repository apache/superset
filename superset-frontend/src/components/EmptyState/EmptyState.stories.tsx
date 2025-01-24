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
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an
 * "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS
 * OF ANY KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import { Meta, StoryFn } from '@storybook/react';
import { Row, Col } from 'antd';
import { EmptyState, imageMap } from '.';

const emptyStates = [
  { title: null, description: null, image: undefined },
  ...Object.keys(imageMap).map(key => ({
    image: key,
    title: `Empty State with image ${key}`,
    description: 'This is the default empty state.',
  })),
];

export default {
  title: 'Empty State Gallery',
  component: EmptyState,
  argTypes: {
    size: {
      control: { type: 'select' },
      options: ['small', 'medium', 'large'],
      defaultValue: 'medium',
      description: 'Size of the Empty State components',
    },
  },
} as Meta;

export const Gallery: StoryFn<{ size: 'small' | 'medium' | 'large' }> = ({
  size,
}) => (
  <Row gutter={[16, 16]}>
    {emptyStates.map((state, index) => (
      <Col key={index} xs={24} sm={12} md={8} lg={6}>
        <EmptyState
          size={size}
          title={state.title}
          description={state.description}
          image={state.image}
        >
          Childrens render here.
        </EmptyState>
      </Col>
    ))}
  </Row>
);

Gallery.args = {
  size: 'medium',
};
