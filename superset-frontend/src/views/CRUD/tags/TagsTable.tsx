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
import React, { useState, useEffect } from 'react';
import moment from 'moment';
import { t, styled } from '@superset-ui/core';
import TableView, { EmptyWrapperType } from 'src/components/TableView';
import { fetchObjects } from '../../../tags';
import Loading from '../../../components/Loading';

const TagsTableContainer = styled.div`
  text-align: left;
  border-radius: ${({ theme }) => theme.gridUnit * 1}px 0;
  margin: 0 ${({ theme }) => theme.gridUnit * 4}px;
  .table {
    table-layout: fixed;
  }
  .td {
    width: 33%;
  }
`;

interface TaggedObject {
  id: number;
  type: string;
  name: string;
  url: string;
  changed_on: moment.MomentInput;
  created_by: number | undefined;
  creator: string;
}

interface TaggedObjects {
  dashboard: TaggedObject[];
  chart: TaggedObject[];
  query: TaggedObject[];
}

interface TagsTableProps {
  search?: string;
}

export default function TagsTable({ search = '' }: TagsTableProps) {
  const [objects, setObjects] = useState<TaggedObjects>({
    dashboard: [],
    chart: [],
    query: [],
  });

  useEffect(() => {
    const fetchResults = (search: string) => {
      fetchObjects(
        { tags: search, types: null },
        (data: TaggedObject[]) => {
          const objects = { dashboard: [], chart: [], query: [] };
          data.forEach(object => {
            objects[object.type].push(object);
          });
          setObjects(objects);
        },
        (error: Response) => {
          console.log(error.json());
        },
      );
    };
    fetchResults(search);
  }, [search]);

  const renderTable = (type: any) => {
    const data = objects[type].map((o: TaggedObject) => ({
      [type]: <a href={o.url}>{o.name}</a>,
      // eslint-disable-next-line react/no-danger
      creator: <div dangerouslySetInnerHTML={{ __html: o.creator }} />,
      modified: moment.utc(o.changed_on).fromNow(),
    }));
    return (
      <TableView
        className="table-condensed"
        emptyWrapperType={EmptyWrapperType.Small}
        data={data}
        pageSize={50}
        columns={[
          {
            accessor: type,
            Header: type.charAt(0).toUpperCase() + type.slice(1),
          },
          { accessor: 'creator', Header: 'Creator' },
          { accessor: 'modified', Header: 'Modified' },
        ]}
      />
    );
  };

  if (objects) {
    return (
      <TagsTableContainer>
        <h3>{t('Dashboards')}</h3>
        {renderTable('dashboard')}
        <hr />
        <h3>{t('Charts')}</h3>
        {renderTable('chart')}
        <hr />
        <h3>{t('Queries')}</h3>
        {renderTable('query')}
      </TagsTableContainer>
    );
  }
  return <Loading />;
}
