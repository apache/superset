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
  { id: 5, title: 'Modified Date', field: 'changed_on_utc' },
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
            ...item,
            database: `${item.database.database_name}`,
            changed_on_utc: moment(item.changed_on_utc).fromNow(),
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
