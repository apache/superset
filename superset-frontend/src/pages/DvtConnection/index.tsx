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
import { dvtSidebarConnectionSetProperty } from 'src/dvt-redux/dvt-sidebarReducer';
import { useAppSelector } from 'src/hooks/useAppSelector';
import DvtPagination from 'src/components/DvtPagination';
import DvtTable from 'src/components/DvtTable';
import withToasts from 'src/components/MessageToasts/withToasts';
import DvtIconDataLabel from 'src/components/DvtIconDataLabel';
import {
  StyledConnection,
  StyledConnectionButton,
} from './dvt-connection.module';

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

function ConnectionList() {
  const dispatch = useDispatch();
  const connectionSelector = useAppSelector(
    state => state.dvtSidebar.connection,
  );
  const [apiData, setApiData] = useState([]);
  const [page, setPage] = useState<number>(1);
  const [editedData, setEditedData] = useState<any[]>([]);

  const clearConnection = () => {
    dispatch(
      dvtSidebarConnectionSetProperty({
        connection: {
          ...connectionSelector,
          expose_in_sqllab: '',
          allow_run_async: '',
          search: '',
        },
      }),
    );
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/v1/database/');
        const data = await response.json();
        const newEditedData = data.result.map((item: any) => ({
          database: item.database_name,
          admin: `${item.created_by?.first_name} ${item.created_by?.last_name}`,
          date: new Date(item.changed_on).toLocaleString('tr-TR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          }),
          expose_in_sqllab: item.expose_in_sqllab,
          allow_run_async: item.allow_run_async,
        }));

        setEditedData(newEditedData);

        const filteredData = newEditedData.filter(
          (item: any) =>
            (connectionSelector.expose_in_sqllab
              ? item.expose_in_sqllab.toString() ===
                connectionSelector.expose_in_sqllab
              : true) &&
            (connectionSelector.allow_run_async
              ? item.allow_run_async.toString() ===
                connectionSelector.allow_run_async
              : true),
        );

        setApiData(filteredData);
      } catch (error) {
        console.error('Hata:', error);
      }
    };

    fetchData();
  }, [connectionSelector]);

  const itemsPerPageValue = 10;
  const indexOfLastItem = page * itemsPerPageValue;
  const indexOfFirstItem = (page - 1) * itemsPerPageValue;
  const currentItems =
    apiData.length > 10
      ? apiData.slice(indexOfFirstItem, indexOfLastItem)
      : apiData;

  return apiData.length > 0 ? (
    <StyledConnection>
      <DvtTable data={currentItems} header={modifiedData.header} />
      <StyledConnectionButton>
        <DvtPagination
          page={page}
          setPage={setPage}
          itemSize={apiData.length}
          pageItemSize={10}
        />
      </StyledConnectionButton>
    </StyledConnection>
  ) : (
    <StyledConnection>
      {editedData.length !== 0 && (
        <DvtIconDataLabel
          label="No results match your filter criteria"
          buttonLabel="Clear All Filter"
          buttonClick={() => {
            clearConnection();
          }}
        />
      )}
    </StyledConnection>
  );
}

export default withToasts(ConnectionList);
