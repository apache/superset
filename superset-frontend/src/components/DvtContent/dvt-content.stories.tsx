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
import { MemoryRouter } from 'react-router-dom';
import DvtContent, { DvtContentProps } from '.';

export default {
  title: 'Dvt-Components/DvtContent',
  component: DvtContent,
  argTypes: {
    withDateAgo: {
      control: { type: 'date' },
      defaultValue: new Date(),
    },
  },
  decorators: [
    (Story: any) => (
      <MemoryRouter>
        <Story />
      </MemoryRouter>
    ),
  ],
};

export const Default = (args: DvtContentProps) => (
  <div style={{ backgroundColor: '#E2E8F0', padding: '20px' }}>
    <DvtContent {...args} />
  </div>
);

Default.args = {
  title: 'Custom Title',
  header: [
    { title: 'Name', field: 'ulas_nam' },
    { title: 'Type', field: 'hqkiled' },
    { title: 'Created', field: 'created', withDateAgo: true, width: 100 },
  ],
  data: [
    {
      id: 1,
      ulas_nam: 'Ulaş',
      hqkiled: 'UlaşType',
      jyo: undefined,
      jojo: 'nothing',
      active: true,
      created: new Date('2023-12-10T00:00:00').toISOString(),
    },
    {
      id: 2,
      ulas_nam: 'Ömer',
      hqkiled: 'ÖmerType',
      jyo: 1,
      jojo: 'other',
      active: true,
      created: new Date('2023-12-15T00:00:00').toISOString(),
    },
    {
      id: 3,
      ulas_nam: 'Ulaş',
      hqkiled: 'UlaşType',
      jyo: 1,
      jojo: 'other',
      active: true,
      created: new Date('2023-07-10T00:00:00').toISOString(),
    },
    {
      id: 4,
      ulas_nam: 'Ömer',
      hqkiled: 'ÖmerType',
      jyo: 1,
      jojo: 'other',
      active: true,
      created: new Date('2023-11-10T00:00:00').toISOString(),
    },
    {
      id: 5,
      ulas_nam: 'Ulaş',
      hqkiled: 'UlaşType',
      jyo: 1,
      jojo: 'other',
      active: true,
      created: new Date('2023-09-10T00:00:00').toISOString(),
    },
    {
      id: 6,
      ulas_nam: 'Ömer',
      hqkiled: 'ÖmerType',
      jyo: 1,
      jojo: 'other',
      active: true,
      created: new Date('2022-11-10T00:00:00').toISOString(),
    },
    {
      id: 7,
      ulas_nam: 'Ulaş',
      hqkiled: 'UlaşType',
      jyo: 1,
      jojo: 'other',
      active: true,
      created: new Date('2023-08-10T00:00:00').toISOString(),
    },
    {
      id: 8,
      ulas_nam: 'Ömer',
      hqkiled: 'ÖmerType',
      jyo: 1,
      jojo: 'other',
      active: true,
      created: new Date('2021-01-10T00:00:00').toISOString(),
    },
  ],
};

export const Scroll = (args: DvtContentProps) => (
  <div style={{ backgroundColor: '#E2E8F0', padding: '20px' }}>
    <DvtContent {...args} />
  </div>
);

Scroll.args = {
  title: 'Custom Title',
  header: [
    { title: 'Name', field: 'ulas_nam' },
    { title: 'Type', field: 'hqkiled' },
    { title: 'Created', field: 'created', withDateAgo: true, width: 100 },
  ],
  data: [
    {
      id: 1,
      ulas_nam: 'Ulaş',
      hqkiled: 'UlaşType',
      jyo: undefined,
      jojo: 'nothing',
      active: true,
      created: new Date('2023-12-10T00:00:00').toISOString(),
    },
    {
      id: 2,
      ulas_nam: 'Ömer',
      hqkiled: 'ÖmerType',
      jyo: 1,
      jojo: 'other',
      active: true,
      created: new Date('2023-12-15T00:00:00').toISOString(),
    },
    {
      id: 3,
      ulas_nam: 'Ulaş',
      hqkiled: 'UlaşType',
      jyo: 1,
      jojo: 'other',
      active: true,
      created: new Date('2023-07-10T00:00:00').toISOString(),
    },
    {
      id: 4,
      ulas_nam: 'Ömer',
      hqkiled: 'ÖmerType',
      jyo: 1,
      jojo: 'other',
      active: true,
      created: new Date('2023-11-10T00:00:00').toISOString(),
    },
    {
      id: 5,
      ulas_nam: 'Ulaş',
      hqkiled: 'UlaşType',
      jyo: 1,
      jojo: 'other',
      active: true,
      created: new Date('2023-09-10T00:00:00').toISOString(),
    },
    {
      id: 6,
      ulas_nam: 'Ömer',
      hqkiled: 'ÖmerType',
      jyo: 1,
      jojo: 'other',
      active: true,
      created: new Date('2022-11-10T00:00:00').toISOString(),
    },
    {
      id: 7,
      ulas_nam: 'Ulaş',
      hqkiled: 'UlaşType',
      jyo: 1,
      jojo: 'other',
      active: true,
      created: new Date('2023-08-10T00:00:00').toISOString(),
    },
    {
      id: 8,
      ulas_nam: 'Ömer',
      hqkiled: 'ÖmerType',
      jyo: 1,
      jojo: 'other',
      active: true,
      created: new Date('2021-01-10T00:00:00').toISOString(),
    },
    {
      id: 9,
      ulas_nam: 'Ulaş',
      hqkiled: 'UlaşType',
      jyo: 1,
      jojo: 'other',
      active: true,
      created: new Date('2020-11-10T00:00:00').toISOString(),
    },
    {
      id: 10,
      ulas_nam: 'Ulaş',
      hqkiled: 'UlaşType',
      jyo: 1,
      jojo: 'other',
      active: true,
      created: new Date('2023-08-10T00:00:00').toISOString(),
    },
    {
      id: 11,
      ulas_nam: 'Ömer',
      hqkiled: 'ÖmerType',
      jyo: 1,
      jojo: 'other',
      active: true,
      created: new Date('2021-01-10T00:00:00').toISOString(),
    },
  ],
};
