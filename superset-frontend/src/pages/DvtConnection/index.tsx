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
import { useAppSelector } from 'src/hooks/useAppSelector';
import DvtPagination from 'src/components/DvtPagination';
import DvtTable from 'src/components/DvtTable';
import withToasts from 'src/components/MessageToasts/withToasts';
import DvtButton from 'src/components/DvtButton';
import DvtIconDataLabel from 'src/components/DvtIconDataLabel';
import { StyledReports, StyledReportsButton } from './dvt-reports.module';

function ReportList() {
  const [apiData, setApiData] = useState([]);

  const [page, setPage] = useState<number>(1);
  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/v1/dataset/');
        const data = await response.json();
        const editedData = data.result.map((item: any) => ({
          database: item.database.database_name,
          admin: `${item.owners[0]?.first_name} ${item.owners[0]?.last_name}`,
          date: new Date(item.changed_on_utc).toLocaleString('tr-TR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          }),
        }));

        setApiData(editedData);
        console.log(data.result);
      } catch (error) {
        console.error('Hata:', error);
      }
    };

    fetchData();
  }, []);
  const modifiedData = {
    header: [
      { id: 1, title: 'Database', field: 'database', heartIcon: true },
      { id: 2, title: 'Admin', field: 'admin' },
      { id: 3, title: 'Last Modified', field: 'date' },
      {
        id: 4,
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

  const itemsPerPageValue = 10;
  const indexOfLastItem = page * itemsPerPageValue;
  const indexOfFirstItem = (page - 1) * itemsPerPageValue;
  const currentItems =
    apiData.length > 10
      ? apiData.slice(indexOfFirstItem, indexOfLastItem)
      : apiData;

  return apiData.length > 0 ? (
    <StyledReports>
      <DvtTable data={currentItems} header={modifiedData.header} />
      <StyledReportsButton>
        <DvtButton
          label="Create a New Connection"
          onClick={() => {}}
          colour="grayscale"
        />
        <DvtPagination
          page={page}
          setPage={setPage}
          itemSize={apiData.length}
          pageItemSize={10}
        />
      </StyledReportsButton>
    </StyledReports>
  ) : (
    <StyledReports>
      <DvtIconDataLabel label="No Connection Yet" buttonLabel="Connections" />
    </StyledReports>
  );
}

export default withToasts(ReportList);
