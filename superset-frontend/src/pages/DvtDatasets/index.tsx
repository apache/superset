import React, { useEffect, useState } from 'react';
import moment from 'moment';
import DvtButton from 'src/components/DvtButton';
import DvtPagination from 'src/components/DvtPagination';
import DvtTable from 'src/components/DvtTable';
import {
  StyledButtons,
  StyledDeselect,
  StyledDeselectButton,
  StyledDvtDatasets,
  StyledSelected,
} from './dvt-datasets.module';

const header = [
  {
    id: 1,
    title: 'Name',
    field: 'table_name',
    flex: 3,
    checkbox: true,
    folderIcon: true,
    onLink: true,
  },
  { id: 2, title: 'Type', field: 'kind' },
  { id: 3, title: 'Database', field: 'database' },
  { id: 4, title: 'Schema', field: 'schema' },
  { id: 5, title: 'Modified Date', field: 'changed_on_delta_humanized' },
  { id: 6, title: 'Modified by', field: 'changed_by_name' },
  { id: 7, title: 'Owners', field: 'owners' },
  {
    id: 8,
    title: 'Actions',
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
        popperLabel: 'Delete',
      },
    ],
  },
];

const getFormattedDifference = (modified: Date) => {
  const now = moment();
  const diff = now.diff(modified);
  const duration = moment.duration(diff);

  const years = duration.years();
  const months = duration.months();
  const days = duration.days();
  const hours = duration.hours();
  const minutes = duration.minutes();

  let dateMessage = 'Just Now';

  if (years > 0) {
    dateMessage = `${years} Years Ago`;
  } else if (months > 0) {
    dateMessage = `${months} Months Ago`;
  } else if (days > 0) {
    dateMessage = `${days} Days Ago`;
  } else if (hours > 0) {
    dateMessage = `${hours} Hours Ago`;
  } else if (minutes > 0) {
    dateMessage = `${minutes} Minutes Ago`;
  }
  return dateMessage;
};

function DvtDatasets() {
  const [currentPage, setCurrentPage] = useState(1);
  const [data, setData] = useState([]);
  const [count, setCount] = useState<number>(0);
  const [selectedRows, setSelectedRows] = useState<any[]>([]);

  useEffect(() => {
    const apiUrl = `/api/v1/dataset/?q=(order_column:changed_on_delta_humanized,order_direction:desc,page:${
      currentPage - 1
    },page_size:10)`;

    const fetchApi = async () => {
      try {
        const response = await fetch(apiUrl);
        const data = await response.json();
        setData(
          data.result.map((item: any) => ({
            id: item.id,
            table_name: item.table_name,
            kind: item.kind,
            database: `${item.database.database_name}`,
            schema: item.schema,
            changed_on_delta_humanized: getFormattedDifference(
              new Date(item.changed_on_utc),
            ),
            changed_by_name: item.changed_by_name,
            owners: item.owners.length
              ? item.owners
                  .map(
                    (item: { first_name: string; last_name: string }) =>
                      `${item.first_name} ${item.last_name}`,
                  )
                  .join(',')
              : '',
          })),
        );
        setCount(data.count);
      } catch (error) {
        console.log('Error:', error);
      }
    };
    fetchApi();
    setSelectedRows([]);
  }, [currentPage]);

  const handleDeselectAll = () => {
    setSelectedRows([]);
  };

  return (
    <StyledDvtDatasets>
      <StyledDeselectButton>
        <StyledSelected>
          <span>{`${selectedRows.length} Selected`}</span>
        </StyledSelected>
        <StyledDeselect>
          <DvtButton
            label="Deselect All"
            bold
            colour="primary"
            typeColour="outline"
            size="medium"
            onClick={handleDeselectAll}
          />
        </StyledDeselect>
      </StyledDeselectButton>
      <div>
        <DvtTable
          data={data}
          header={header}
          selected={selectedRows}
          setSelected={setSelectedRows}
          checkboxActiveField="id"
        />
      </div>
      <StyledButtons>
        <DvtButton
          label="Create a New Dataset"
          onClick={() => {}}
          colour="grayscale"
          typeColour="basic"
          size="small"
        />
        <DvtPagination
          page={currentPage}
          setPage={setCurrentPage}
          itemSize={count}
          pageItemSize={10}
        />
      </StyledButtons>
    </StyledDvtDatasets>
  );
}

export default DvtDatasets;
