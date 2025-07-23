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
import { extendedDayjs } from '@superset-ui/core/utils/dates';
import { t, styled } from '@superset-ui/core';
import {
  TableView,
  EmptyWrapperType,
} from '@superset-ui/core/components/TableView';
import { EmptyState } from '@superset-ui/core/components';
import { FacePile, TagsList, type TagType } from 'src/components';
import { TaggedObject, TaggedObjects } from 'src/types/TaggedObject';
import { Typography } from '@superset-ui/core/components/Typography';

const MAX_TAGS_TO_SHOW = 3;
const PAGE_SIZE = 10;

const AllEntitiesTableContainer = styled.div`
  text-align: left;
  border-radius: ${({ theme }) => theme.borderRadius}px 0;
  .table {
    table-layout: fixed;
  }
  .td {
    width: 33%;
  }
  .entity-title {
    font-family: Inter;
    font-size: ${({ theme }) => theme.fontSize}px;
    font-weight: ${({ theme }) => theme.fontWeightStrong};
    line-height: 17px;
    letter-spacing: 0px;
    text-align: left;
    margin: ${({ theme }) => theme.sizeUnit * 4}px 0;
  }
`;

interface AllEntitiesTableProps {
  search?: string;
  setShowTagModal: (show: boolean) => void;
  objects: TaggedObjects;
  canEditTag: boolean;
}

export default function AllEntitiesTable({
  search = '',
  setShowTagModal,
  objects,
  canEditTag,
}: AllEntitiesTableProps) {
  type objectType = 'dashboard' | 'chart' | 'query';

  const showDashboardList = objects.dashboard.length > 0;
  const showChartList = objects.chart.length > 0;
  const showQueryList = objects.query.length > 0;
  const showListViewObjs = showDashboardList || showChartList || showQueryList;

  const renderTable = (type: objectType) => {
    const data = objects[type].map((o: TaggedObject) => ({
      [type]: <Typography.Link href={o.url}>{o.name}</Typography.Link>,
      modified: extendedDayjs.utc(o.changed_on).fromNow(),
      tags: o.tags,
      owners: o.owners,
    }));

    return (
      <TableView
        className="table-condensed"
        emptyWrapperType={EmptyWrapperType.Small}
        data={data}
        pageSize={PAGE_SIZE}
        columns={[
          {
            accessor: type,
            Header: 'Title',
            id: type,
          },
          {
            Cell: ({
              row: {
                original: { tags = [] },
              },
            }: {
              row: {
                original: {
                  tags: TagType[];
                };
              };
            }) => (
              // Only show custom type tags
              <TagsList
                tags={tags.filter(
                  (tag: TagType) =>
                    tag.type !== undefined &&
                    ['TagType.custom', 1].includes(tag.type),
                )}
                maxTags={MAX_TAGS_TO_SHOW}
              />
            ),
            Header: t('Tags'),
            accessor: 'tags',
            disableSortBy: true,
            id: 'tags',
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
            id: 'owners',
          },
        ]}
      />
    );
  };

  return (
    <AllEntitiesTableContainer>
      {showListViewObjs ? (
        <>
          {showDashboardList && (
            <>
              <div className="entity-title">{t('Dashboards')}</div>
              {renderTable('dashboard')}
            </>
          )}
          {showChartList && (
            <>
              <div className="entity-title">{t('Charts')}</div>
              {renderTable('chart')}
            </>
          )}
          {showQueryList && (
            <>
              <div className="entity-title">{t('Queries')}</div>
              {renderTable('query')}
            </>
          )}
        </>
      ) : (
        <EmptyState
          image="dashboard.svg"
          size="large"
          title={t('No entities have this tag currently assigned')}
          {...(canEditTag && {
            buttonAction: () => setShowTagModal(true),
            buttonText: t('Add tag to entities'),
          })}
        />
      )}
    </AllEntitiesTableContainer>
  );
}
