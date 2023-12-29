import React, { useEffect, useState } from 'react';
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
  StyledSelectedItem,
  StyledSelectedItemCount,
} from './dvtdashboardlist.module';
import { useHistory } from 'react-router-dom';

const headerData = [
  { id: 1, title: 'Title', field: 'dashboard_title', flex: 3, checkbox: true },
  { id: 2, title: 'Modified By', field: 'changed_by_name' },
  { id: 3, title: 'Status', field: 'status' },
  { id: 4, title: 'Modified', field: 'created_on_delta_humanized' },
  { id: 5, title: 'Created By', field: 'createdbyName' },
  { id: 6, title: 'Owners', field: 'owners' },
  {
    id: 7,
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
        popperLabel: 'Delete',
      },
    ],
  },
];

function DvtDashboardList() {
  const [selectedRows, setSelectedRows] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [selectedItemCount, setSelectedItemCount] = useState<number>(0);
  const [data, setData] = useState([]);

  const history = useHistory<{ from: string }>();

  useEffect(() => {
    const apiUrl = `/api/v1/dashboard/?q=(order_column:changed_on_delta_humanized,order_direction:desc,page:${
      currentPage - 1
    },page_size:10)`;

    const fetchApi = async () => {
      try {
        const response = await fetch(apiUrl);
        const data = await response.json();
        setData(
          data.result.map((item: any) => {
            return {
              dashboard_title: item.dashboard_title,
              changed_by_name: item.changed_by_name,
              status: item.status,
              created_on_delta_humanized: item.created_on_delta_humanized,
              owners: `${item.owners.first_name} ${item.owners.last_name}`,
              createdbyName: `${item.created_by.first_name} ${item.created_by.last_name}`,
            };
          }),
        );
      } catch (error) {
        console.log('Error:', error);
      }
    };
    fetchApi();
  }, []);

  useEffect(() => {
    setSelectedItemCount(selectedRows.length);
  }, [selectedRows]);

  const handleDeselectAll = () => {
    setSelectedRows([]);
    setSelectedItemCount(0);
  };

  const handleCreateDashboard = () => {
    history.push('/superset/dashboard');
  };
  console.log(data);
  return (
    <StyledDashboardList>
      <StyledDashboardListButtons>
        <StyledDvtSelectButtons>
          <StyledSelectedItem>
            <StyledSelectedItemCount>
              <span>{`${selectedItemCount} Selected`}</span>
            </StyledSelectedItemCount>
            <DvtButton
              label="Deselect All"
              bold
              colour="primary"
              typeColour="outline"
              size="medium"
              onClick={handleDeselectAll}
            />
          </StyledSelectedItem>
        </StyledDvtSelectButtons>
        <StyledDashboardButtons>
          <DvtButton
            label="Delete"
            icon="dvt-delete"
            iconToRight
            colour="error"
            size="small"
            onClick={() => {}}
          />
          <DvtButton
            label="Export"
            icon="dvt-export"
            iconToRight
            colour="primary"
            bold
            typeColour="powder"
            size="small"
            onClick={() => {}}
          />
        </StyledDashboardButtons>
      </StyledDashboardListButtons>
      <StyledDashboardTable>
        <DvtTable
          data={data}
          header={headerData}
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
            onClick={handleCreateDashboard}
          />
        </StyledDashboardCreateDashboard>
        <StyledDashboardPagination>
          <DvtPagination
            page={currentPage}
            setPage={setCurrentPage}
            itemSize={data.length}
            pageItemSize={10}
          />
        </StyledDashboardPagination>
      </StyledDashboardBottom>
    </StyledDashboardList>
  );
}

export default withToasts(DvtDashboardList);
