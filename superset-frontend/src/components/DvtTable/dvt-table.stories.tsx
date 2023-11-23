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

export const Default = (args: DvtTableProps) => {
  const [page, setPage] = useState(1);

  const handlePageChange = (newPage: number) => setPage(newPage);

  return (
    <div style={{ width: 1440, height: 1050 }}>
      <DvtTable {...args} page={page} setPage={handlePageChange} />
    </div>
  );
};

Default.args = {
  header: [
    {
      title: 'Name',
      field: 'name',
      folderIcon: true,
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
  <div style={{ width: 1440, height: 1050 }}>
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

export const IconExample = (args: DvtTableProps) => {
  const [page, setPage] = useState(1);

  const handlePageChange = (newPage: number) => setPage(newPage);

  return (
    <div style={{ width: 1440, height: 1050 }}>
      <DvtTable {...args} page={page} setPage={handlePageChange} />
    </div>
  );
};

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

export const HoverExample = (args: DvtTableProps) => {
  const [page, setPage] = useState(1);

  const handlePageChange = (newPage: number) => setPage(newPage);

  return (
    <div style={{ width: 1440, height: 1050 }}>
      <DvtTable {...args} page={page} setPage={handlePageChange} />
    </div>
  );
};

HoverExample.args = {
  header: [
    {
      title: 'Name',
      field: 'name',
      folderIcon: true,
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

export const IconColourExample = (args: DvtTableProps) => {
  const [page, setPage] = useState(1);

  const handlePageChange = (newPage: number) => setPage(newPage);

  return (
    <div style={{ width: 1440, height: 1050 }}>
      <DvtTable {...args} page={page} setPage={handlePageChange} />
    </div>
  );
};

IconColourExample.args = {
  header: [
    {
      title: 'Name',
      field: 'name',
      folderIcon: true,
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

export const PaginationExample = (args: DvtTableProps) => {
  const [page, setPage] = useState(1);

  const handlePageChange = (newPage: number) => setPage(newPage);

  return (
    <div style={{ width: 1440, height: 1050 }}>
      <DvtTable
        {...args}
        page={page}
        setPage={handlePageChange}
        itemsPerPage={3}
      />
    </div>
  );
};

PaginationExample.args = {
  header: [
    {
      title: 'Name',
      field: 'name',
      folderIcon: true,
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
  pagination: true,
};
