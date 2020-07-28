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
import React from 'react';
// import { action } from '@storybook/addon-actions';
// import { withKnobs, boolean, select, text } from '@storybook/addon-knobs';
import Card from './index';

export default {
  title: 'Card',
  component: Card,
  // decorators: [withKnobs],
};

export const SupersetCard = () => (
  <Card title="Here's a title!">
    Here's some text!
  </Card>
);

export const SupersetCardGrid = () => (
  <Card title="Card Title">
    <Card.Grid>Content</Card.Grid>
    <Card.Grid hoverable={false}>
      Content
    </Card.Grid>
    <Card.Grid>Content</Card.Grid>
    <Card.Grid>Content</Card.Grid>
    <Card.Grid>Content</Card.Grid>
    <Card.Grid>Content</Card.Grid>
    <Card.Grid>Content</Card.Grid>
  </Card>
);

export const SupersetCardMeta = () => (
  <Card title="Card Title">
    <Card.Meta
      title="Superset Rules"
      description="https://superset.incubator.apache.org/"
    />
  </Card>
);


