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
import { Row, Col } from '@superset-ui/core/components';
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
  title: 'Components/EmptyState',
  component: EmptyState,
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

Gallery.argTypes = {
  size: {
    control: { type: 'select' },
    options: ['small', 'medium', 'large'],
    description: 'Size of the Empty State components',
  },
};

// Interactive story for docs
export const InteractiveEmptyState: StoryFn<{
  size: 'small' | 'medium' | 'large';
  title: string;
  description: string;
  image: string;
  buttonText: string;
}> = args => <EmptyState {...args} />;

InteractiveEmptyState.args = {
  size: 'medium',
  title: 'No Data Available',
  description: 'There is no data to display at this time.',
  image: 'empty.svg',
  buttonText: '',
};

InteractiveEmptyState.argTypes = {
  size: {
    control: { type: 'select' },
    options: ['small', 'medium', 'large'],
    description: 'Size of the empty state component.',
  },
  title: {
    control: { type: 'text' },
    description: 'Main title text.',
  },
  description: {
    control: { type: 'text' },
    description: 'Description text below the title.',
  },
  image: {
    control: { type: 'select' },
    options: [
      'chart.svg',
      'document.svg',
      'empty-charts.svg',
      'empty-dashboard.svg',
      'empty-dataset.svg',
      'empty-query.svg',
      'empty-table.svg',
      'empty.svg',
      'empty_sql_chart.svg',
      'filter-results.svg',
      'filter.svg',
      'star-circle.svg',
      'union.svg',
      'vector.svg',
    ],
    description: 'Predefined image to display.',
  },
  buttonText: {
    control: { type: 'text' },
    description: 'Text for optional action button.',
  },
};

// All available image keys for gallery
const imageKeys = [
  'chart.svg',
  'document.svg',
  'empty-charts.svg',
  'empty-dashboard.svg',
  'empty-dataset.svg',
  'empty-query.svg',
  'empty-table.svg',
  'empty.svg',
  'empty_sql_chart.svg',
  'filter-results.svg',
  'filter.svg',
  'star-circle.svg',
  'union.svg',
  'vector.svg',
];

// Single size for gallery display
const gallerySizes = ['medium'];

InteractiveEmptyState.parameters = {
  docs: {
    description: {
      story:
        'A component for displaying empty states with optional images and actions.',
    },
    gallery: {
      component: 'EmptyState',
      sizes: gallerySizes,
      styles: imageKeys,
      sizeProp: 'size',
      styleProp: 'image',
    },
    liveExample: `function Demo() {
  return (
    <EmptyState
      size="medium"
      title="No Results Found"
      description="Try adjusting your filters or search terms."
      image="filter.svg"
      buttonText="Clear Filters"
      buttonAction={() => alert('Filters cleared!')}
    />
  );
}`,
  },
};
