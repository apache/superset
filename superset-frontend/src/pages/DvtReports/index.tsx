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
import { t } from '@superset-ui/core';
import { useDispatch } from 'react-redux';
import { dvtSidebarReportsSetProperty } from 'src/dvt-redux/dvt-sidebarReducer';
import { useAppSelector } from 'src/hooks/useAppSelector';
import DvtPagination from 'src/components/DvtPagination';
import DvtTable from 'src/components/DvtTable';
import withToasts from 'src/components/MessageToasts/withToasts';
import DvtButton from 'src/components/DvtButton';
import DvtIconDataLabel from 'src/components/DvtIconDataLabel';
import { StyledReports, StyledReportsButton } from './dvt-reports.module';

const modifiedData = {
  header: [
    {
      id: 1,
      title: 'Name',
      field: 'slice_name',
      checkbox: true,
    },
    { id: 2, title: 'Visualization Type', field: 'viz_type' },
    { id: 3, title: 'Dataset', field: 'datasource_name_text' },
    { id: 4, title: 'Modified date', field: 'date' },
    { id: 5, title: 'Modified by', field: 'changed_by' },
    { id: 6, title: 'Created by', field: 'created_by' },
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

function ReportList() {
  const dispatch = useDispatch();
  const reportsSelector = useAppSelector(state => state.dvtSidebar.reports);
  const [page, setPage] = useState<number>(1);
  const [selectedRows, setSelectedRows] = useState<any[]>([]);
  const [editedData, setEditedData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);

  const clearReports = () => {
    dispatch(
      dvtSidebarReportsSetProperty({
        reports: {
          ...reportsSelector,
          owner: '',
          createdBy: '',
          chartType: '',
          dataset: '',
          dashboards: '',
          favorite: '',
          certified: '',
        },
      }),
    );
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/v1/chart/');
        const data = await response.json();
        const newEditedData = data.result.map((item: any) => ({
          ...item,
          date: new Date(item.changed_on_utc).toLocaleString('tr-TR'),
          created_by: `${item.created_by.first_name} ${item.created_by.last_name}`,
          changed_by: `${item.changed_by.first_name} ${item.changed_by.last_name}`,
          owner: `${item.owners[0].first_name} ${item.owners[0].last_name}`,
          dashboards: item.dashboards[0]?.dashboard_title,
          certified: item.certified_by,
        }));

        setEditedData(newEditedData);
        setFilteredData(newEditedData);
      } catch (error) {
        console.error('Hata:', error);
      }
    };

    fetchData();
    setSelectedRows([]);
  }, [page]);

  const handleDeselectAll = () => {
    setSelectedRows([]);
  };

  useEffect(() => {
    const filteredData = editedData.filter(
      (item: any) =>
        (reportsSelector.owner ? item.owner === reportsSelector.owner : true) &&
        (reportsSelector.createdBy
          ? item.created_by === reportsSelector.createdBy
          : true) &&
        (reportsSelector.chartType
          ? item.type === reportsSelector.chartType
          : true) &&
        (reportsSelector.dataset
          ? item.crontab_humanized === reportsSelector.dataset
          : true) &&
        (reportsSelector.dashboards
          ? item.dashboards === reportsSelector.dashboards
          : true) &&
        (reportsSelector.certified
          ? item.certified === reportsSelector.certified
          : true),
    );

    setFilteredData(filteredData);
  }, [reportsSelector]);

  const itemsPerPageValue = 10;
  const indexOfLastItem = page * itemsPerPageValue;
  const indexOfFirstItem = (page - 1) * itemsPerPageValue;
  const currentItems =
    filteredData.length > 10
      ? filteredData.slice(indexOfFirstItem, indexOfLastItem)
      : filteredData;

  return filteredData.length > 0 ? (
    <StyledReports>
      <div>
        <DvtButton
          label={t('Deselect All')}
          bold
          colour="primary"
          typeColour="outline"
          size="medium"
          onClick={handleDeselectAll}
        />
      </div>
      <DvtTable
        data={currentItems}
        header={modifiedData.header}
        selected={selectedRows}
        setSelected={setSelectedRows}
        checkboxActiveField="id"
      />
      <StyledReportsButton>
        <DvtButton
          label={t('Create a New Graph/Chart')}
          onClick={() => {}}
          colour="grayscale"
        />
        <DvtPagination
          page={page}
          setPage={setPage}
          itemSize={filteredData.length}
          pageItemSize={10}
        />
      </StyledReportsButton>
    </StyledReports>
  ) : (
    <StyledReports>
      <DvtIconDataLabel
        label={
          editedData.length === 0
            ? t('No Alerts Yet')
            : t('No results match your filter criteria')
        }
        buttonLabel={
          editedData.length === 0 ? t('Alert') : t('Clear All Filter')
        }
        buttonClick={() => {
          if (editedData.length > 0) {
            clearReports();
          }
        }}
      />
    </StyledReports>
  );
}

export default withToasts(ReportList);
