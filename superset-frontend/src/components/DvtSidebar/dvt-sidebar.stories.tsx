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
import DvtSidebar, { DvtSidebarProps } from '.';

export default {
  title: 'Dvt-Components/DvtSidebar',
  component: DvtSidebar,
};

export const Default = (args: DvtSidebarProps) => {
  return <DvtSidebar {...args} />;
};
Default.args = {
  welcomeData: [
    {
      items: [
        {
          title: 'menu',
          data: [
            {
              title: 'Connections',
              url: '/',
              fileName: 'dvt-activity',
            },
            { title: 'Dataset', url: '/', fileName: 'dvt-database' },
            { title: 'Dashboard', url: '/', fileName: 'dvt-box' },
            {
              title: 'Report',
              url: '/',
              fileName: 'dvt-analytic_chart',
            },
            { title: 'Alert', url: '/', fileName: 'dvt-alert' },
          ],
        },
        {
          title: 'my folder',
          data: [
            {
              name: 'Dnext',
              url: '',
              data: [
                {
                  name: 'Dashboard 1',
                  url: '',
                  data: [
                    { name: 'Report 1', url: '/dashboard/1/report/1' },
                    { name: 'Report 2', url: '/dashboard/1/report/2' },
                  ],
                },
                { name: 'Dashboard 2 ', url: '/dashboard/2', data: [] },
              ],
            },
            {
              name: 'Planning',
              url: '/planning',
              data: [],
            },
            {
              name: 'Reporting',
              url: '/reporting',
              data: [],
            },
          ],
        },
        {
          title: 'shared folder',
          data: [], 
        },
      ],
    },
  ],
};

