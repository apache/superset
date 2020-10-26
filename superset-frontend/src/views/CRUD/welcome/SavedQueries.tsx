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
import { t, SupersetClient } from '@superset-ui/core';
import withToasts from 'src/messageToasts/enhancers/withToasts';
import { Dropdown, Menu } from 'src/common/components';
import { useListViewResource, copyQueryLink } from 'src/views/CRUD/hooks';
import ListViewCard from 'src/components/ListViewCard';
import DeleteModal from 'src/components/DeleteModal';
import Icon from 'src/components/Icon';
import SubMenu from 'src/components/Menu/SubMenu';
import EmptyState from './EmptyState';

import { IconContainer, CardContainer, createErrorHandler } from '../utils';

const PAGE_SIZE = 3;

interface Query {
  id?: number;
  sql_tables?: Array<any>;
  database?: {
    database_name: string;
  };
  rows?: string;
  description?: string;
  end_time?: string;
  label?: string;
}

interface SavedQueriesProps {
  user: {
    userId: string | number;
  };
  queryFilter: string;
  addDangerToast: (arg0: string) => void;
  addSuccessToast: (arg0: string) => void;
}

const SavedQueries = ({
  user,
  addDangerToast,
  addSuccessToast,
}: SavedQueriesProps) => {
  const {
    state: { loading, resourceCollection: queries },
    hasPerm,
    fetchData,
    refreshData,
  } = useListViewResource<Query>('saved_query', t('query'), addDangerToast);
  const [queryFilter, setQueryFilter] = useState('Favorite');
  const [queryDeleteModal, setQueryDeleteModal] = useState(false);
  const [currentlyEdited, setCurrentlyEdited] = useState<Query>({});

  const canEdit = hasPerm('can_edit');
  const canDelete = hasPerm('can_delete');

  const handleQueryDelete = ({ id, label }: Query) => {
    SupersetClient.delete({
      endpoint: `/api/v1/saved_query/${id}`,
    }).then(
      () => {
        refreshData();
        setQueryDeleteModal(false);
        addSuccessToast(t('Deleted: %s', label));
      },
      createErrorHandler(errMsg =>
        addDangerToast(t('There was an issue deleting %s: %s', label, errMsg)),
      ),
    );
  };

  const getFilters = () => {
    const filters = [];

    if (queryFilter === 'Mine') {
      filters.push({
        id: 'created_by',
        operator: 'rel_o_m',
        value: `${user?.userId}`,
      });
    } else {
      filters.push({
        id: 'id',
        operator: 'saved_query_is_fav',
        value: true,
      });
    }
    return filters;
  };

  useEffect(() => {
    fetchData({
      pageIndex: 0,
      pageSize: PAGE_SIZE,
      sortBy: [
        {
          id: 'changed_on_delta_humanized',
          desc: true,
        },
      ],
      filters: getFilters(),
    });
  }, [queryFilter]);

  const renderMenu = (query: Query) => (
    <Menu>
      {canEdit && (
        <Menu.Item
          onClick={() => {
            window.location.href = `/superset/sqllab?savedQueryId=${query.id}`;
          }}
        >
          {t('Edit')}
        </Menu.Item>
      )}
      <Menu.Item
        onClick={() => {
          if (query.id)
            copyQueryLink(query.id, addDangerToast, addSuccessToast);
        }}
      >
        {t('Share')}
      </Menu.Item>
      {canDelete && (
        <Menu.Item
          onClick={() => {
            setQueryDeleteModal(true);
            setCurrentlyEdited(query);
          }}
        >
          {t('Delete')}
        </Menu.Item>
      )}
    </Menu>
  );
  return (
    <>
      {queryDeleteModal && (
        <DeleteModal
          description={t(
            'This action will permanently delete the saved query.',
          )}
          onConfirm={() => {
            if (queryDeleteModal) {
              handleQueryDelete(currentlyEdited);
            }
          }}
          onHide={() => {
            setQueryDeleteModal(false);
          }}
          open
          title={t('Delete Query?')}
        />
      )}
      <SubMenu
        activeChild={queryFilter}
        tabs={[
          {
            name: 'Favorite',
            label: t('Favorite'),
            onClick: () => setQueryFilter('Favorite'),
          },
          {
            name: 'Mine',
            label: t('Mine'),
            onClick: () => setQueryFilter('Mine'),
          },
        ]}
        buttons={[
          {
            name: (
              <IconContainer>
                <Icon name="plus-small" /> SQL Query{' '}
              </IconContainer>
            ),
            buttonStyle: 'tertiary',
            onClick: () => {
              window.location.href = '/superset/sqllab';
            },
          },
          {
            name: 'View All »',
            buttonStyle: 'link',
            onClick: () => {
              window.location.href = '/savedqueryview/list';
            },
          },
        ]}
      />
      {queries.length > 0 ? (
        <CardContainer>
          {queries.map(q => (
            <ListViewCard
              key={`${q.id}`}
              imgFallbackURL=""
              imgURL=""
              url={`/superset/sqllab?savedQueryId=${q.id}`}
              title={q.label}
              rows={q.rows}
              tableName={q?.sql_tables && q.sql_tables[0]?.table}
              tables={q?.sql_tables?.length}
              loading={loading}
              description={t('Last run ', q.end_time)}
              showImg={false}
              actions={
                <ListViewCard.Actions>
                  <Dropdown overlay={renderMenu(q)}>
                    <Icon name="more-horiz" />
                  </Dropdown>
                </ListViewCard.Actions>
              }
            />
          ))}
        </CardContainer>
      ) : (
        <EmptyState tableName="SAVED_QUERIES" tab={queryFilter} />
      )}
    </>
  );
};

export default withToasts(SavedQueries);
