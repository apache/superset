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
import { t, styled, logging } from '@superset-ui/core';
import TableView, { EmptyWrapperType } from 'src/components/TableView';
import { addDangerToast } from 'src/components/MessageToasts/actions';
import Loading from 'src/components/Loading';
import { TagsList } from 'src/components/Tags';
import FacePile from 'src/components/FacePile';
import Tag from 'src/types/TagType';
import Owner from 'src/types/Owner';
import { EmptyStateBig } from 'src/components/EmptyState';
import { fetchObjects } from '../tags/tags';

const MAX_TAGS_TO_SHOW = 3;

const AllEntitiesTableContainer = styled.div`
  text-align: left;
  border-radius: ${({ theme }) => theme.gridUnit * 1}px 0;
  .table {
    table-layout: fixed;
  }
  .td {
    width: 33%;
  }
  .entity-title {
    font-family: Inter;
    font-size: ${({ theme }) => theme.typography.sizes.m}px;
    font-weight: ${({ theme }) => theme.typography.weights.medium};
    line-height: 17px;
    letter-spacing: 0px;
    text-align: left;
    margin: ${({ theme }) => theme.gridUnit * 4}px 0;
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
  owners: Owner[];
  tags: Tag[];
}

interface TaggedObjects {
  dashboard: TaggedObject[];
  chart: TaggedObject[];
  query: TaggedObject[];
}

interface AllEntitiesTableProps {
  search?: string;
  setShowTagModal: (show: boolean) => void;
}

export default function AllEntitiesTable({
  search = '',
  setShowTagModal,
}: AllEntitiesTableProps) {
  type objectType = 'dashboard' | 'chart' | 'query';

  const [objects, setObjects] = useState<TaggedObjects>({
    dashboard: [],
    chart: [],
    query: [],
  });
  const [isLoading, setLoading] = useState<boolean>(true);
  const showListViewObjs =
    objects.dashboard.length > 0 ||
    objects.chart.length > 0 ||
    objects.query.length > 0;

  useEffect(() => {
    if (search === '') {
      return;
    }

    setLoading(true);

    fetchObjects(
      { tags: search, types: null },
      (data: TaggedObject[]) => {
        const objects = { dashboard: [], chart: [], query: [] };
        data.forEach(function (object) {
          const object_type = object.type;
          objects[object_type].push(object);
        });
        setObjects(objects);
        setLoading(false);
      },
      (error: Response) => {
        addDangerToast('Error Fetching Tagged Objects');
        logging.log(error.text);
      },
    );
  }, [search]);

  const renderTable = (type: objectType) => {
    const data = objects[type].map((o: TaggedObject) => ({
      [type]: <a href={o.url}>{o.name}</a>,
      modified: moment.utc(o.changed_on).fromNow(),
      tags: o.tags,
      owners: o.owners,
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
            Header: 'Title',
          },
          {
            Cell: ({
              row: {
                original: { tags = [] },
              },
            }: {
              row: {
                original: {
                  tags: Tag[];
                };
              };
            }) => (
              // Only show custom type tags
              <TagsList
                tags={tags.filter(
                  (tag: Tag) =>
                    tag.type === 'TagTypes.custom' || tag.type === 1,
                )}
                maxTags={MAX_TAGS_TO_SHOW}
              />
            ),
            Header: t('Tags'),
            accessor: 'tags',
            disableSortBy: true,
          },
          {
            Cell: ({
              row: {
                original: { owners = [] },
              },
            }: any) => <FacePile users={owners} />,
            Header: t('Owners'),
            accessor: 'owners',
            disableSortBy: true,
            size: 'xl',
          },
        ]}
      />
    );
  };

  if (isLoading) return <Loading />;
  return (
    <AllEntitiesTableContainer>
      {showListViewObjs ? (
        <>
          <div className="entity-title">{t('Dashboards')}</div>
          {renderTable('dashboard')}
          <div className="entity-title">{t('Charts')}</div>
          {renderTable('chart')}
          <div className="entity-title">{t('Queries')}</div>
          {renderTable('query')}
        </>
      ) : (
        <EmptyStateBig
          image="dashboard.svg"
          title={t('No entities have this tag currently assigned')}
          buttonAction={() => setShowTagModal(true)}
          buttonText={t('Add tag to entities')}
        />
      )}
    </AllEntitiesTableContainer>
  );
}
