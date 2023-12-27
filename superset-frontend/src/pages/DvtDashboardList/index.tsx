import React, { useState } from 'react';
import DvtButton from 'src/components/DvtButton';
import DvtPagination from 'src/components/DvtPagination';
import DvtTable from 'src/components/DvtTable';
import withToasts from 'src/components/MessageToasts/withToasts';
import {
  StyledDashboardBottom,
  StyledDashboardButtons,
  StyledDashboardCreateDashboard,
  StyledDashboardList,
  StyledDashboardListButtons,
  StyledDashboardPagination,
  StyledDashboardTable,
  StyledDvtSelectButtons,
} from './dvtdashboardlist.module';

const dummyData = [
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
];

const dummyHeader = [
  { id: 1, title: 'ID', field: 'id', flex: 1, checkbox: true },
  { id: 2, title: 'Title', field: 'title', flex: 2 },
  { id: 3, title: 'Date', field: 'date', flex: 2 },
];

function DvtDashboardList() {
  const [selectedRows, setSelectedRows] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState<number>(1);

  return (
    <StyledDashboardList>
      <StyledDashboardListButtons>
        <StyledDvtSelectButtons>
          <DvtButton
            label="Unselect All"
            bold
            colour="primary"
            typeColour="outline"
            onClick={() => {}}
          />
        </StyledDvtSelectButtons>
        <StyledDashboardButtons>
          <DvtButton
            label="Delete"
            icon="dvt-delete"
            iconToRight
            colour="error"
            onClick={() => {}}
          />
          <DvtButton
            label="Export"
            icon="dvt-export"
            iconToRight
            colour="primary"
            bold
            typeColour="powder"
            onClick={() => {}}
          />
        </StyledDashboardButtons>
      </StyledDashboardListButtons>
      <StyledDashboardTable>
        <DvtTable
          data={dummyData}
          header={dummyHeader}
          selected={selectedRows}
          setSelected={setSelectedRows}
          checkboxActiveField="id"
        />
      </StyledDashboardTable>
      <StyledDashboardBottom>
        <StyledDashboardCreateDashboard>
          <DvtButton
            label="Create a New Dashboard"
            colour="grayscale"
            bold
            typeColour="basic"
            onClick={() => {}}
          />
        </StyledDashboardCreateDashboard>
        <StyledDashboardPagination>
          <DvtPagination
            page={currentPage}
            setPage={setCurrentPage}
            itemSize={dummyData.length}
            pageItemSize={10}
          />
        </StyledDashboardPagination>
      </StyledDashboardBottom>
    </StyledDashboardList>
  );
}

export default withToasts(DvtDashboardList);
