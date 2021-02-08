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
import { withKnobs, number } from '@storybook/addon-knobs';
import FacePile from '.';

export default {
  title: 'FacePile',
  component: FacePile,
  decorators: [withKnobs],
};

const firstNames = [
  'James',
  'Mary',
  'John',
  'Patricia',
  'Mohamed',
  'Venkat',
  'Lao',
  'Robert',
  'Jennifer',
  'Michael',
  'Linda',
];
const lastNames = [
  'Smith',
  'Johnson',
  'Williams',
  'Saeed',
  'Jones',
  'Brown',
  'Tzu',
];

const users = [...new Array(10)].map((_, i) => ({
  first_name: firstNames[Math.floor(Math.random() * firstNames.length)],
  last_name: lastNames[Math.floor(Math.random() * lastNames.length)],
  id: i,
}));

export const SupersetFacePile = () => (
  <FacePile users={users} maxCount={number('maxCount', 4)} />
);
