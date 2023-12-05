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
import { Meta } from '@storybook/react';
import DvtList, { DvtListProps } from '.';

export default {
  title: 'Dvt-Components/Dvt-List',
  component: DvtList,
} as Meta;

export const Default = (args: DvtListProps) => (
  <div style={{ width: '250px', backgroundColor: '#B8C1CC', padding:'20px' }}>
    <DvtList {...args} />
  </div>
);

Default.args = {
  data: [
    { id: 1, title: 'table_schema_id', subtitle: 'integer' },
    { id: 2, title: 'table_schema_title', subtitle: 'string' },
    { id: 3, title: 'table_schema_subtitle', subtitle: 'string' },
    { id: 4, title: 'table_schema_subtitle', subtitle: 'string' },
    { id: 5, title: 'table_schema_subtitle', subtitle: 'string' },
    { id: 6, title: 'table_schema_subtitle', subtitle: 'string' },
    { id: 7, title: 'table_schema_subtitle', subtitle: 'string' },
    { id: 8, title: 'table_schema_subtitle', subtitle: 'string' },
    { id: 9, title: 'table_schema_subtitle', subtitle: 'string' },
    { id: 10, title: 'table_schema_subtitle', subtitle: 'string' },
    { id: 11, title: 'table_schema_subtitle', subtitle: 'string' },
    { id: 12, title: 'table_schema_subtitle', subtitle: 'string' },
    { id: 13, title: 'table_schema_subtitle', subtitle: 'string' },
    { id: 14, title: 'table_schema_subtitle', subtitle: 'string' },
    { id: 15, title: 'table_schema_subtitle', subtitle: 'string' },
    { id: 16, title: 'table_schema_subtitle', subtitle: 'string' },
    { id: 17, title: 'table_schema_subtitle', subtitle: 'string' },
    { id: 18, title: 'table_schema_subtitle', subtitle: 'string' },
    { id: 19, title: 'table_schema_subtitle', subtitle: 'string' },
    { id: 20, title: 'table_schema_subtitle', subtitle: 'string' },
    { id: 21, title: 'table_schema_subtitle', subtitle: 'string' },
    { id: 22, title: 'table_schema_subtitle', subtitle: 'string' },
    { id: 23, title: 'table_schema_subtitle', subtitle: 'string' },
    { id: 24, title: 'table_schema_subtitle', subtitle: 'string' },
    { id: 25, title: 'table_schema_subtitle', subtitle: 'string' },
  ],
};
