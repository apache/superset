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
import DvtTable, { DvtTableProps } from '.';

export default {
  title: 'Dvt-Components/DvtTable',
  component: DvtTable,
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
    <DvtTable {...args} />
  </div>
);

Default.args = {
  header: [
    {
      title: 'Name',
      field: 'name',
      icon: 'dvt-folder',
      onLink: true,
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
  data: [
    {
      name: 'arac',
      type: 'Pysical',
      database: 'PostgreSQL',
      schema: 'Dwh',
      date: '10.03.2023 12:45:00',
      modifiedBy: 'Admin',
      owners: 'A',
    },
    {
      name: 'hrrr2',
      type: 'Pysical',
      database: 'PostgreSQL',
      schema: 'Public',
      date: '10.03.2023 12:45:00',
      modifiedBy: 'Admin',
      owners: 'A',
    },
    {
      name: 'channel_members',
      type: 'Pysical',
      database: 'Examples',
      schema: 'Public',
      date: '10.03.2023 12:45:00',
      modifiedBy: 'Admin',
      owners: 'A',
    },
    {
      name: 'channel',
      type: 'Pysical',
      database: 'Examples',
      schema: 'Public',
      date: '10.03.2023 12:45:00',
      modifiedBy: 'Admin',
      owners: 'A',
    },
    {
      name: 'cleaned_sales_data',
      type: 'Pysical',
      database: 'Examples',
      schema: 'Public',
      date: '10.03.2023 12:45:00',
      modifiedBy: 'Admin',
      owners: 'A',
    },
    {
      name: 'covid_vaccines',
      type: 'Pysical',
      database: 'Examples',
      schema: 'Public',
      date: '10.03.2023 12:45:00',
      modifiedBy: 'Admin',
      owners: 'A',
    },
    {
      name: 'exported_stats',
      type: 'Pysical',
      database: 'Examples',
      schema: 'Public',
      date: '10.03.2023 12:45:00',
      modifiedBy: 'Admin',
      owners: 'A',
    },
    {
      name: 'members_channels_2',
      type: 'Pysical',
      database: 'Examples',
      schema: 'Public',
      date: '10.03.2023 12:45:00',
      modifiedBy: 'Admin',
      owners: 'A',
    },
    {
      name: 'Fcc 2018 Survey',
      type: 'Pysical',
      database: 'Examples',
      schema: 'Public',
      date: '10.03.2023 12:45:00',
      modifiedBy: 'Admin',
      owners: 'A',
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
    <DvtTable {...args} />
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
  data: [
    {
      id: '64e417of7f25253d56019818b7e9fdcD',
      is_software_dev: '0',
      is_first_dev_job: 'Null',
      months_job_search: 'Null',
      months_job_search2: 'Null',
      job_pref: 'freelance',
    },
    {
      id: '64e417of7f25253d56019818b7e9fdcD',
      is_software_dev: '0',
      is_first_dev_job: 'Null',
      months_job_search: 'Null',
      months_job_search2: 'Null',
      job_pref: 'freelance',
    },
    {
      id: '64e417of7f25253d56019818b7e9fdcD',
      is_software_dev: '0',
      is_first_dev_job: 'Null',
      months_job_search: 'Null',
      months_job_search2: 'Null',
      job_pref: 'freelance',
    },
    {
      id: '64e417of7f25253d56019818b7e9fdcD',
      is_software_dev: '0',
      is_first_dev_job: 'Null',
      months_job_search: 'Null',
      months_job_search2: 'Null',
      job_pref: 'freelance',
    },
    {
      id: '64e417of7f25253d56019818b7e9fdcD',
      is_software_dev: '0',
      is_first_dev_job: 'Null',
      months_job_search: 'Null',
      months_job_search2: 'Null',
      job_pref: 'freelance',
    },
    {
      id: '64e417of7f25253d56019818b7e9fdcD',
      is_software_dev: '0',
      is_first_dev_job: 'Null',
      months_job_search: 'Null',
      months_job_search2: 'Null',
      job_pref: 'freelance',
    },
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
    <DvtTable {...args} />
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
    { title: 'SQL', field: 'sql', onLink: true },
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
  data: [
    {
      date: '2023.05.29 15:53:47 * 03:00',
      tabName: 'Pysical',
      database: 'PostgreSQL',
      schema: 'Public',
      tables: 'hrr2',
      user: 'Admin',
      rows: '564',
      sql: 'Select',
    },
    {
      date: '2023.05.29 15:53:47 * 03:00',
      tabName: 'Pysical',
      database: 'PostgreSQL',
      schema: 'Public',
      tables: 'hrr2',
      user: 'Admin',
      rows: '564',
      sql: 'Select',
    },
    {
      date: '2023.05.29 15:53:47 * 03:00',
      tabName: 'Pysical',
      database: 'PostgreSQL',
      schema: 'Public',
      tables: 'hrr2',
      user: 'Admin',
      rows: '564',
      sql: 'Select',
    },
    {
      date: '2023.05.29 15:53:47 * 03:00',
      tabName: 'Pysical',
      database: 'PostgreSQL',
      schema: 'Public',
      tables: 'hrr2',
      user: 'Admin',
      rows: '564',
      sql: 'Select',
    },
    {
      date: '2023.05.29 15:53:47 * 03:00',
      tabName: 'Pysical',
      database: 'PostgreSQL',
      schema: 'Public',
      tables: 'hrr2',
      user: 'Admin',
      rows: '564',
      sql: 'Select',
    },
    {
      date: '2023.05.29 15:53:47 * 03:00',
      tabName: 'Pysical',
      database: 'PostgreSQL',
      schema: 'Public',
      tables: 'hrr2',
      user: 'Admin',
      rows: '564',
      sql: 'Select',
    },
    {
      date: '2023.05.29 15:53:47 * 03:00',
      tabName: 'Pysical',
      database: 'PostgreSQL',
      schema: 'Public',
      tables: 'hrr2',
      user: 'Admin',
      rows: '564',
      sql: 'Select',
    },
    {
      date: '2023.05.29 15:53:47 * 03:00',
      tabName: 'Pysical',
      database: 'PostgreSQL',
      schema: 'Public',
      tables: 'hrr2',
      user: 'Admin',
      rows: '564',
      sql: 'Select',
    },
    {
      date: '2023.05.29 15:53:47 * 03:00',
      tabName: 'Pysical',
      database: 'PostgreSQL',
      schema: 'Public',
      tables: 'hrr2',
      user: 'Admin',
      rows: '564',
      sql: 'Select',
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
    <DvtTable {...args} />
  </div>
);

HoverExample.args = {
  header: [
    {
      title: 'Name',
      field: 'name',
      icon: 'dvt-folder',
      onLink: true,
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
  data: [
    {
      name: 'arac',
      type: 'Pysical',
      database: 'PostgreSQL',
      schema: 'Dwh',
      date: '10.03.2023 12:45:00',
      modifiedBy: 'Admin',
      owners: 'A',
    },
    {
      name: 'hrrr2',
      type: 'Pysical',
      database: 'PostgreSQL',
      schema: 'Public',
      date: '10.03.2023 12:45:00',
      modifiedBy: 'Admin',
      owners: 'A',
    },
    {
      name: 'channel_members',
      type: 'Pysical',
      database: 'Examples',
      schema: 'Public',
      date: '10.03.2023 12:45:00',
      modifiedBy: 'Admin',
      owners: 'A',
    },
    {
      name: 'channel',
      type: 'Pysical',
      database: 'Examples',
      schema: 'Public',
      date: '10.03.2023 12:45:00',
      modifiedBy: 'Admin',
      owners: 'A',
    },
    {
      name: 'cleaned_sales_data',
      type: 'Pysical',
      database: 'Examples',
      schema: 'Public',
      date: '10.03.2023 12:45:00',
      modifiedBy: 'Admin',
      owners: 'A',
    },
    {
      name: 'covid_vaccines',
      type: 'Pysical',
      database: 'Examples',
      schema: 'Public',
      date: '10.03.2023 12:45:00',
      modifiedBy: 'Admin',
      owners: 'A',
    },
    {
      name: 'exported_stats',
      type: 'Pysical',
      database: 'Examples',
      schema: 'Public',
      date: '10.03.2023 12:45:00',
      modifiedBy: 'Admin',
      owners: 'A',
    },
    {
      name: 'members_channels_2',
      type: 'Pysical',
      database: 'Examples',
      schema: 'Public',
      date: '10.03.2023 12:45:00',
      modifiedBy: 'Admin',
      owners: 'A',
    },
    {
      name: 'Fcc 2018 Survey',
      type: 'Pysical',
      database: 'Examples',
      schema: 'Public',
      date: '10.03.2023 12:45:00',
      modifiedBy: 'Admin',
      owners: 'A',
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
    <DvtTable {...args} />
  </div>
);

IconColourExample.args = {
  header: [
    {
      title: 'Name',
      field: 'name',
      icon: 'dvt-folder',
      onLink: true,
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
  data: [
    {
      name: 'arac',
      type: 'Pysical',
      database: 'PostgreSQL',
      schema: 'Dwh',
      date: '10.03.2023 12:45:00',
      modifiedBy: 'Admin',
      owners: 'A',
    },
    {
      name: 'hrrr2',
      type: 'Pysical',
      database: 'PostgreSQL',
      schema: 'Public',
      date: '10.03.2023 12:45:00',
      modifiedBy: 'Admin',
      owners: 'A',
    },
    {
      name: 'channel_members',
      type: 'Pysical',
      database: 'Examples',
      schema: 'Public',
      date: '10.03.2023 12:45:00',
      modifiedBy: 'Admin',
      owners: 'A',
    },
    {
      name: 'channel',
      type: 'Pysical',
      database: 'Examples',
      schema: 'Public',
      date: '10.03.2023 12:45:00',
      modifiedBy: 'Admin',
      owners: 'A',
    },
    {
      name: 'cleaned_sales_data',
      type: 'Pysical',
      database: 'Examples',
      schema: 'Public',
      date: '10.03.2023 12:45:00',
      modifiedBy: 'Admin',
      owners: 'A',
    },
    {
      name: 'covid_vaccines',
      type: 'Pysical',
      database: 'Examples',
      schema: 'Public',
      date: '10.03.2023 12:45:00',
      modifiedBy: 'Admin',
      owners: 'A',
    },
    {
      name: 'exported_stats',
      type: 'Pysical',
      database: 'Examples',
      schema: 'Public',
      date: '10.03.2023 12:45:00',
      modifiedBy: 'Admin',
      owners: 'A',
    },
    {
      name: 'members_channels_2',
      type: 'Pysical',
      database: 'Examples',
      schema: 'Public',
      date: '10.03.2023 12:45:00',
      modifiedBy: 'Admin',
      owners: 'A',
    },
    {
      name: 'Fcc 2018 Survey',
      type: 'Pysical',
      database: 'Examples',
      schema: 'Public',
      date: '10.03.2023 12:45:00',
      modifiedBy: 'Admin',
      owners: 'A',
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
      <DvtTable {...args} selected={selected} setSelected={setSelected} />
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
      onLink: true,
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
  data: [
    {
      id: 1,
      name: 'arac',
      type: 'Pysical',
      database: 'PostgreSQL',
      schema: 'Dwh',
      date: '10.03.2023 12:45:00',
      modifiedBy: 'Admin',
      owners: 'A',
    },
    {
      id: 2,
      name: 'hrrr2',
      type: 'Pysical',
      database: 'PostgreSQL',
      schema: 'Public',
      date: '10.03.2023 12:45:00',
      modifiedBy: 'Admin',
      owners: 'A',
    },
    {
      id: 3,
      name: 'channel_members',
      type: 'Pysical',
      database: 'Examples',
      schema: 'Public',
      date: '10.03.2023 12:45:00',
      modifiedBy: 'Admin',
      owners: 'A',
    },
    {
      id: 4,
      name: 'channel',
      type: 'Pysical',
      database: 'Examples',
      schema: 'Public',
      date: '10.03.2023 12:45:00',
      modifiedBy: 'Admin',
      owners: 'A',
    },
    {
      id: 5,
      name: 'cleaned_sales_data',
      type: 'Pysical',
      database: 'Examples',
      schema: 'Public',
      date: '10.03.2023 12:45:00',
      modifiedBy: 'Admin',
      owners: 'A',
    },
    {
      id: 6,
      name: 'covid_vaccines',
      type: 'Pysical',
      database: 'Examples',
      schema: 'Public',
      date: '10.03.2023 12:45:00',
      modifiedBy: 'Admin',
      owners: 'A',
    },
    {
      id: 7,
      name: 'exported_stats',
      type: 'Pysical',
      database: 'Examples',
      schema: 'Public',
      date: '10.03.2023 12:45:00',
      modifiedBy: 'Admin',
      owners: 'A',
    },
    {
      id: 8,
      name: 'members_channels_2',
      type: 'Pysical',
      database: 'Examples',
      schema: 'Public',
      date: '10.03.2023 12:45:00',
      modifiedBy: 'Admin',
      owners: 'A',
    },
    {
      id: 9,
      name: 'Fcc 2018 Survey',
      type: 'Pysical',
      database: 'Examples',
      schema: 'Public',
      date: '10.03.2023 12:45:00',
      modifiedBy: 'Admin',
      owners: 'A',
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
      <DvtTable {...args} selected={selected} setSelected={setSelected} />
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
      onLink: true,
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
  data: [
    {
      id: 1,
      name: 'arac',
      type: 'Pysical',
      database: 'PostgreSQL',
      schema: 'Dwh',
      date: '10.03.2023 12:45:00',
      modifiedBy: 'Admin',
      owners: 'A',
      active: true,
    },
    {
      id: 2,
      name: 'hrrr2',
      type: 'Pysical',
      database: 'PostgreSQL',
      schema: 'Public',
      date: '10.03.2023 12:45:00',
      modifiedBy: 'Admin',
      owners: 'A',
      active: false,
    },    {
      id: 3,
      name: 'arac',
      type: 'Pysical',
      database: 'PostgreSQL',
      schema: 'Dwh',
      date: '10.03.2023 12:45:00',
      modifiedBy: 'Admin',
      owners: 'A',
      active: true,
    },
    {
      id: 4,
      name: 'hrrr2',
      type: 'Pysical',
      database: 'PostgreSQL',
      schema: 'Public',
      date: '10.03.2023 12:45:00',
      modifiedBy: 'Admin',
      owners: 'A',
      active: false,
    },    {
      id: 5,
      name: 'arac',
      type: 'Pysical',
      database: 'PostgreSQL',
      schema: 'Dwh',
      date: '10.03.2023 12:45:00',
      modifiedBy: 'Admin',
      owners: 'A',
      active: true,
    },
    {
      id: 6,
      name: 'hrrr2',
      type: 'Pysical',
      database: 'PostgreSQL',
      schema: 'Public',
      date: '10.03.2023 12:45:00',
      modifiedBy: 'Admin',
      owners: 'A',
      active: false,
    },    {
      id: 7,
      name: 'arac',
      type: 'Pysical',
      database: 'PostgreSQL',
      schema: 'Dwh',
      date: '10.03.2023 12:45:00',
      modifiedBy: 'Admin',
      owners: 'A',
      active: true,
    },
    {
      id: 8,
      name: 'hrrr2',
      type: 'Pysical',
      database: 'PostgreSQL',
      schema: 'Public',
      date: '10.03.2023 12:45:00',
      modifiedBy: 'Admin',
      owners: 'A',
      active: false,
    },    {
      id: 9,
      name: 'arac',
      type: 'Pysical',
      database: 'PostgreSQL',
      schema: 'Dwh',
      date: '10.03.2023 12:45:00',
      modifiedBy: 'Admin',
      owners: 'A',
      active: true,
    },
    {
      id: 10,
      name: 'hrrr2',
      type: 'Pysical',
      database: 'PostgreSQL',
      schema: 'Public',
      date: '10.03.2023 12:45:00',
      modifiedBy: 'Admin',
      owners: 'A',
      active: false,
    },
  ],
};
