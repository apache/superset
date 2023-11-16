import React, { useState } from 'react';
import DvtTable, { DvtTableProps } from '.';

export default {
  title: 'Dvt-Components/DvtTable',
  component: DvtTable,
};

export const Default = (args: DvtTableProps) => {
  const [currentPage, setCurrentPage] = useState(1);

  const handlePageChange = (newPage: number) => setCurrentPage(newPage);

  return (
    <div style={{ width: 1440, height: 1050 }}>
      <DvtTable
        {...args}
        currentPage={currentPage}
        setcurrentPage={handlePageChange}
      />
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

export const IconExample = (args: DvtTableProps) => {
  const [currentPage, setCurrentPage] = useState(1);

  const handlePageChange = (newPage: number) => setCurrentPage(newPage);

  return (
    <div style={{ width: 1440, height: 1050 }}>
      <DvtTable
        {...args}
        currentPage={currentPage}
        setcurrentPage={handlePageChange}
      />
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
  const [currentPage, setCurrentPage] = useState(1);

  const handlePageChange = (newPage: number) => setCurrentPage(newPage);

  return (
    <div style={{ width: 1440, height: 1050 }}>
      <DvtTable
        {...args}
        currentPage={currentPage}
        setcurrentPage={handlePageChange}
      />
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
  const [currentPage, setCurrentPage] = useState(1);

  const handlePageChange = (newPage: number) => setCurrentPage(newPage);

  return (
    <div style={{ width: 1440, height: 1050 }}>
      <DvtTable
        {...args}
        currentPage={currentPage}
        setcurrentPage={handlePageChange}
      />
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
  const [currentPage, setCurrentPage] = useState(1);

  const handlePageChange = (newPage: number) => setCurrentPage(newPage);

  return (
    <div style={{ width: 1440, height: 1050 }}>
      <DvtTable
        {...args}
        currentPage={currentPage}
        setcurrentPage={handlePageChange}
        pagination
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
};
