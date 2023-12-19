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
import { useDispatch } from 'react-redux';
import { dvtSidebarAlertsSetProperty } from 'src/dvt-redux/dvt-sidebarReducer';
import { useAppSelector } from 'src/hooks/useAppSelector';
import DvtPagination from 'src/components/DvtPagination';
import DvtTable from 'src/components/DvtTable';
import withToasts from 'src/components/MessageToasts/withToasts';
import DvtButton from 'src/components/DvtButton';
import DvtIconDataLabel from 'src/components/DvtIconDataLabel';
import { StyledAlerts, StyledAlertsButton } from './dvt-alerts.module';

const modifiedData = {
  header: [
    { id: 1, title: 'Last Run', field: 'lastRun', heartIcon: true },
    { id: 2, title: 'Name', field: 'name' },
    { id: 3, title: 'Schedule', field: 'schedule' },
    { id: 4, title: 'Notification Method', field: 'notificationMethod' },
    { id: 5, title: 'Created By', field: 'createdBy' },
    { id: 6, title: 'Owners', field: 'owners' },
    { id: 7, title: 'Modified', field: 'modified' },
    { id: 8, title: 'Active', field: 'active' },
    {
      id: 9,
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
  ],
};

function AlertList() {
  const dispatch = useDispatch();
  const alertsSelector = useAppSelector(state => state.dvtSidebar.alerts);
  const [apiData, setApiData] = useState([]);
  const [page, setPage] = useState<number>(1);
  const [editedData, setEditedData] = useState<any[]>([]);

  const clearAlerts = () => {
    dispatch(
      dvtSidebarAlertsSetProperty({
        alerts: {
          ...alertsSelector,
          createdBy: '',
          owner: '',
          status: '',
          search: '',
        },
      }),
    );
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/v1/report/');
        const data = await response.json();
        const newEditedData = data.result
          .filter((item: any) => item.type === 'Alert')
          .map((item: any) => ({
            lastRun: new Date(item.last_eval_dttm).toLocaleString('tr-TR', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            }),
            name: item.name,
            schedule: new Date(item.created_on).toLocaleString('tr-TR', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            }),
            notificationMethod: item.crontab_humanized,
            createdBy: `${item.created_by?.first_name} ${item.created_by?.last_name}`,
            owners: `${item.owners[0].first_name} ${item.owners[0].last_name}`,
            modified: `${item.changed_by.first_name} ${item.changed_by.last_name}`,
            status: item.last_state,
            active: item.active.toString(),
          }));

        setEditedData(newEditedData);

        const filteredData = newEditedData.filter(
          (item: any) =>
            (alertsSelector.owner
              ? item.owners === alertsSelector.owner
              : true) &&
            (alertsSelector.status
              ? item.status === alertsSelector.status
              : true) &&
            (alertsSelector.createdBy
              ? item.createdBy === alertsSelector.createdBy
              : true),
        );

        setApiData(filteredData);
      } catch (error) {
        console.error('Hata:', error);
      }
    };

    fetchData();
  }, [alertsSelector]);

  const itemsPerPageValue = 10;
  const indexOfLastItem = page * itemsPerPageValue;
  const indexOfFirstItem = (page - 1) * itemsPerPageValue;
  const currentItems =
    apiData.length > 10
      ? apiData.slice(indexOfFirstItem, indexOfLastItem)
      : apiData;

  return apiData.length > 0 ? (
    <StyledAlerts>
      <DvtTable data={currentItems} header={modifiedData.header} />
      <StyledAlertsButton>
        <DvtButton
          label="Create a New Alert"
          onClick={() => {}}
          colour="grayscale"
        />
        <DvtPagination
          page={page}
          setPage={setPage}
          itemSize={apiData.length}
          pageItemSize={10}
        />
      </StyledAlertsButton>
    </StyledAlerts>
  ) : (
    <StyledAlerts>
      <DvtIconDataLabel
        label={
          editedData.length === 0
            ? 'No Alerts Yet'
            : 'No results match your filter criteria'
        }
        buttonLabel={editedData.length === 0 ? 'Alert' : 'Clear All Filter'}
        buttonClick={() => {
          editedData.length > 0 && clearAlerts();
        }}
      />
    </StyledAlerts>
  );
}

export default withToasts(AlertList);
