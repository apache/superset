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

import React, { useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import useFetch from 'src/hooks/useFetch';
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

const headerData = [
  {
    id: 1,
    title: 'Title',
    field: 'dashboard_title',
    flex: 3,
    checkbox: true,
    urlField: 'url',
  },
  {
    id: 2,
    title: 'Modified By',
    field: 'changed_by_name',
    urlField: 'changed_by_url',
  },
  { id: 3, title: 'Status', field: 'status' },
  { id: 4, title: 'Modified', field: 'created_on_delta_humanized' },
  { id: 5, title: 'Created By', field: 'createdbyName' },
  { id: 6, title: 'Owners', field: 'owners' },
  {
    id: 7,
    title: 'Action',
    showHover: true,
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
  const history = useHistory<{ from: string }>();

  const [selectedRows, setSelectedRows] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [data, setData] = useState([]);
  const [count, setCount] = useState<number>(0);

  const dashboardApi = useFetch({
    url: `/api/v1/dashboard/?q=(order_column:changed_on_delta_humanized,order_direction:desc,page:${
      currentPage - 1
    },page_size:10)`,
  });

  useEffect(() => {
    if (dashboardApi) {
      setData(
        dashboardApi.result.map((item: any) => ({
          ...item,
          owners: item.owners.length
            ? item.owners
                .map(
                  (item: { first_name: string; last_name: string }) =>
                    `${item.first_name} ${item.last_name}`,
                )
                .join(',')
            : '',
          createdbyName: item.changed_by
            ? `${item.changed_by.first_name} ${item.changed_by.last_name}`
            : '',
        })),
      );
      setCount(dashboardApi.count);
      setSelectedRows([]);
    }
  }, [dashboardApi]);

  const handleDeselectAll = () => {
    setSelectedRows([]);
  };

  const handleCreateDashboard = () => {
    history.push('/superset/dashboard');
  };

  return (
    <StyledDashboardList>
      <StyledDashboardListButtons>
        <StyledDvtSelectButtons>
          <StyledSelectedItem>
            <StyledSelectedItemCount>
              <span>{`${selectedRows.length} Selected`}</span>
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
            itemSize={count}
            pageItemSize={10}
          />
        </StyledDashboardPagination>
      </StyledDashboardBottom>
    </StyledDashboardList>
  );
}

export default withToasts(DvtDashboardList);
