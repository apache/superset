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
import React, { useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import DvtTable, { DvtTableProps } from '.';

import TableData from './dvt-table-data';

export default {
  title: 'Dvt-Components/DvtTable',
  component: DvtTable,
  decorators: [
    (Story: any) => (
      <MemoryRouter>
        <Story />
      </MemoryRouter>
    ),
  ],
};

export const Default = (args: DvtTableProps) => (
  <div
    style={{
      width: 1440,
      height: 1050,
      backgroundColor: '#F8FAFC',
      padding: 32,
    }}
  >
    <DvtTable {...args} data={TableData.defaultData} />
  </div>
);

Default.args = {
  header: [
    {
      title: 'Name',
      field: 'name',
      icon: 'dvt-folder',
      urlField: 'link',
      flex: 3,
    },
    { title: 'Type', field: 'type' },
    { title: 'Database', field: 'database' },
    { title: 'Schema', field: 'schema' },
    { title: 'Modified Date', field: 'date' },
    { title: 'Modified By', field: 'modifiedBy' },
    { title: 'Owners', field: 'owners' },
    {
      title: 'Action',
      clicks: [
        {
          icon: 'edit_alt',
          click: () => {},
          popperLabel: 'Edit',
        },

        {
          icon: 'share',
          click: () => {},
          popperLabel: 'Export',
        },
        {
          icon: 'trash',
          click: () => {},
          popperLabel: 'Share',
        },
      ],
    },
  ],
};

export const FavoriteExample = (args: DvtTableProps) => {
  const [data, setData] = useState<any[]>(TableData.favoritesData);
  return (
    <div
      style={{
        width: 1440,
        height: 1050,
        backgroundColor: '#F8FAFC',
        padding: 32,
      }}
    >
      <DvtTable {...args} data={data} setFavoriteData={setData} />
    </div>
  );
};

FavoriteExample.args = {
  header: [
    { isFavorite: true, flex: 0.5 },
    {
      title: 'Name',
      field: 'name',
      urlField: 'link',
      flex: 3,
    },
    { title: 'Type', field: 'type' },
    { title: 'Database', field: 'database' },
    { title: 'Schema', field: 'schema' },
    { title: 'Modified Date', field: 'date' },
    { title: 'Modified By', field: 'modifiedBy' },
    { title: 'Owners', field: 'owners' },
    {
      title: 'Action',
      clicks: [
        {
          icon: 'edit_alt',
          click: () => {},
          popperLabel: 'Edit',
        },

        {
          icon: 'share',
          click: () => {},
          popperLabel: 'Export',
        },
        {
          icon: 'trash',
          click: () => {},
          popperLabel: 'Share',
        },
      ],
    },
  ],
};

export const Example = (args: DvtTableProps) => (
  <div
    style={{
      width: 1440,
      height: 1050,
      backgroundColor: '#F8FAFC',
      padding: 32,
    }}
  >
    <DvtTable {...args} data={TableData.exampleData} />
  </div>
);

Example.args = {
  header: [
    {
      title: 'ID',
      field: 'id',
      flex: 2,
    },
    { title: 'is_software_dev', field: 'is_software_dev' },
    { title: 'is_first_dev_job', field: 'is_first_dev_job' },
    { title: 'months_job_search', field: 'months_job_search' },
    { title: 'months_job_search', field: 'months_job_search2' },
    { title: 'job_pref', field: 'job_pref' },
  ],
};

export const IconExample = (args: DvtTableProps) => (
  <div
    style={{
      width: 1440,
      height: 1050,
      backgroundColor: '#F8FAFC',
      padding: 32,
    }}
  >
    <DvtTable {...args} data={TableData.iconExampleData} />
  </div>
);

IconExample.args = {
  header: [
    {
      title: 'Time',
      field: 'date',
    },
    { title: 'Tab Name', field: 'tabName' },
    { title: 'Database', field: 'database' },
    { title: 'Schema', field: 'schema' },
    { title: 'Tables', field: 'tables' },
    { title: 'User', field: 'user' },
    { title: 'Rows', field: 'rows' },
    { title: 'SQL', field: 'sql', urlField: 'link' },
    {
      title: 'Action',
      clicks: [
        {
          icon: 'favorite-unselected',
          click: () => {},
        },
      ],
    },
  ],
};

export const HoverExample = (args: DvtTableProps) => (
  <div
    style={{
      width: 1440,
      height: 1050,
      backgroundColor: '#F8FAFC',
      padding: 32,
    }}
  >
    <DvtTable {...args} data={TableData.hoverExampleData} />
  </div>
);

HoverExample.args = {
  header: [
    {
      title: 'Name',
      field: 'name',
      icon: 'dvt-folder',
      urlField: 'link',
      flex: 3,
    },
    { title: 'Type', field: 'type' },
    { title: 'Database', field: 'database' },
    { title: 'Schema', field: 'schema' },
    { title: 'Modified Date', field: 'date' },
    { title: 'Modified By', field: 'modifiedBy' },
    { title: 'Owners', field: 'owners' },
    {
      title: 'Action',
      showHover: true,
      clicks: [
        {
          icon: 'edit_alt',
          click: () => {},
        },

        {
          icon: 'share',
          click: () => {},
        },
        {
          icon: 'trash',
          click: () => {},
        },
      ],
    },
  ],
};

export const IconColourExample = (args: DvtTableProps) => (
  <div
    style={{
      width: 1440,
      height: 1050,
      backgroundColor: '#F8FAFC',
      padding: 32,
    }}
  >
    <DvtTable {...args} data={TableData.iconColourExampleData} />
  </div>
);

IconColourExample.args = {
  header: [
    {
      title: 'Name',
      field: 'name',
      icon: 'dvt-folder',
      urlField: 'link',
      flex: 3,
    },
    { title: 'Type', field: 'type' },
    { title: 'Database', field: 'database' },
    { title: 'Schema', field: 'schema' },
    { title: 'Modified Date', field: 'date' },
    { title: 'Modified By', field: 'modifiedBy' },
    { title: 'Owners', field: 'owners' },
    {
      title: 'Action',
      clicks: [
        {
          icon: 'edit_alt',
          click: () => {},
        },

        {
          icon: 'share',
          click: () => {},
        },
        {
          icon: 'trash',
          click: () => {},
          colour: 'red',
        },
      ],
    },
  ],
};

export const CheckboxExample = (args: DvtTableProps) => {
  const [selected, setSelected] = useState<number[]>([]);

  return (
    <div
      style={{
        width: 1440,
        height: 1050,
        backgroundColor: '#F8FAFC',
        padding: 32,
      }}
    >
      <DvtTable
        {...args}
        data={TableData.checkboxExampleData}
        selected={selected}
        setSelected={setSelected}
      />
    </div>
  );
};

CheckboxExample.args = {
  header: [
    { checkbox: true, field: 'checkbox', flex: 0.5 },
    {
      title: 'Name',
      field: 'name',
      icon: 'dvt-folder',
      urlField: 'link',
      flex: 3,
    },
    { title: 'Type', field: 'type' },
    { title: 'Database', field: 'database' },
    { title: 'Schema', field: 'schema' },
    { title: 'Modified Date', field: 'date' },
    { title: 'Modified By', field: 'modifiedBy' },
    { title: 'Owners', field: 'owners' },
    {
      title: 'Action',
      clicks: [
        {
          icon: 'edit_alt',
          click: () => {},
        },

        {
          icon: 'share',
          click: () => {},
        },
        {
          icon: 'trash',
          click: () => {},
        },
      ],
    },
  ],
};

export const ActiveColumn = (args: DvtTableProps) => {
  const [selected, setSelected] = useState<number[]>([]);

  return (
    <div
      style={{
        width: 1440,
        height: 1050,
        backgroundColor: '#F8FAFC',
        padding: 32,
      }}
    >
      <DvtTable
        {...args}
        data={TableData.activeColumnData}
        selected={selected}
        setSelected={setSelected}
      />
    </div>
  );
};

ActiveColumn.args = {
  header: [
    {
      title: 'Name',
      field: 'name',
      icon: 'dvt-folder',
      iconActive: 'dvt-file',
      urlField: 'link',
      flex: 3,
    },
    { title: 'Type', field: 'type' },
    { title: 'Database', field: 'database' },
    { title: 'Schema', field: 'schema' },
    { title: 'Modified Date', field: 'date' },
    { title: 'Modified By', field: 'modifiedBy' },
    { title: 'Owners', field: 'owners' },
    {
      title: 'Action',
      clicks: [
        {
          icon: 'edit_alt',
          click: () => {},
        },

        {
          icon: 'share',
          click: () => {},
        },
        {
          icon: 'trash',
          click: () => {},
        },
      ],
    },
  ],
};
