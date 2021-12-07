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
import React, { useState } from 'react';
import { styled, SupersetClient, t, useTheme } from '@superset-ui/core';
import SyntaxHighlighter from 'react-syntax-highlighter/dist/cjs/light';
import sql from 'react-syntax-highlighter/dist/cjs/languages/hljs/sql';
import github from 'react-syntax-highlighter/dist/cjs/styles/hljs/github';
import { LoadingCards } from 'src/views/CRUD/welcome/Welcome';
import withToasts from 'src/components/MessageToasts/withToasts';
import { Dropdown, Menu } from 'src/common/components';
import { copyQueryLink, useListViewResource } from 'src/views/CRUD/hooks';
import ListViewCard from 'src/components/ListViewCard';
import DeleteModal from 'src/components/DeleteModal';
import Icons from 'src/components/Icons';
import SubMenu from 'src/components/Menu/SubMenu';
import EmptyState from './EmptyState';
import {
  CardContainer,
  createErrorHandler,
  PAGE_SIZE,
  shortenSQL,
} from '../utils';
import { WelcomeTable } from './types';

SyntaxHighlighter.registerLanguage('sql', sql);

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
  changed_on_delta_humanized?: string;
  sql?: string | null;
}

interface SavedQueriesProps {
  user: {
    userId: string | number;
  };
  queryFilter: string;
  addDangerToast: (arg0: string) => void;
  addSuccessToast: (arg0: string) => void;
  mine: Array<Query>;
  showThumbnails: boolean;
  featureFlag: boolean;
}

export const CardStyles = styled.div`
  cursor: pointer;
  a {
    text-decoration: none;
  }
  .ant-card-cover {
    border-bottom: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
    & > div {
      height: 171px;
    }
  }
  .gradient-container > div {
    background-size: contain;
    background-repeat: no-repeat;
    background-position: center;
    background-color: ${({ theme }) => theme.colors.secondary.light3};
    display: inline-block;
    width: 100%;
    height: 179px;
    background-repeat: no-repeat;
    vertical-align: middle;
  }
`;

const QueryData = styled.div`
  svg {
    margin-left: ${({ theme }) => theme.gridUnit * 10}px;
  }
  .query-title {
    padding: ${({ theme }) => theme.gridUnit * 2 + 2}px;
    font-size: ${({ theme }) => theme.typography.sizes.l}px;
  }
`;

const QueryContainer = styled.div`
  pre {
    height: ${({ theme }) => theme.gridUnit * 40}px;
    border: none !important;
    background-color: ${({ theme }) =>
      theme.colors.grayscale.light5} !important;
    overflow: hidden;
    padding: ${({ theme }) => theme.gridUnit * 4}px !important;
  }
`;

const SavedQueries = ({
  user,
  addDangerToast,
  addSuccessToast,
  mine,
  showThumbnails,
  featureFlag,
}: SavedQueriesProps) => {
  const {
    state: { loading, resourceCollection: queries },
    hasPerm,
    fetchData,
    refreshData,
  } = useListViewResource<Query>(
    'saved_query',
    t('query'),
    addDangerToast,
    true,
    mine,
    [],
    false,
  );
  const [queryFilter, setQueryFilter] = useState('Mine');
  const [queryDeleteModal, setQueryDeleteModal] = useState(false);
  const [currentlyEdited, setCurrentlyEdited] = useState<Query>({});
  const [ifMine, setMine] = useState(true);
  const canEdit = hasPerm('can_edit');
  const canDelete = hasPerm('can_delete');

  const theme = useTheme();

  const handleQueryDelete = ({ id, label }: Query) => {
    SupersetClient.delete({
      endpoint: `/api/v1/saved_query/${id}`,
    }).then(
      () => {
        const queryParams = {
          filters: [
            {
              id: 'created_by',
              operator: 'rel_o_m',
              value: `${user?.userId}`,
            },
          ],
          pageSize: PAGE_SIZE,
          sortBy: [
            {
              id: 'changed_on_delta_humanized',
              desc: true,
            },
          ],
          pageIndex: 0,
        };
        // if mine is default there refresh data with current filters
        const filter = ifMine ? queryParams : undefined;
        refreshData(filter);
        setMine(false);
        setQueryDeleteModal(false);
        addSuccessToast(t('Deleted: %s', label));
      },
      createErrorHandler(errMsg =>
        addDangerToast(t('There was an issue deleting %s: %s', label, errMsg)),
      ),
    );
  };

  const getFilters = (filterName: string) => {
    const filters = [];
    if (filterName === 'Mine') {
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

  const getData = (filter: string) =>
    fetchData({
      pageIndex: 0,
      pageSize: PAGE_SIZE,
      sortBy: [
        {
          id: 'changed_on_delta_humanized',
          desc: true,
        },
      ],
      filters: getFilters(filter),
    });

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
          if (query.id) {
            copyQueryLink(query.id, addDangerToast, addSuccessToast);
          }
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

  if (loading) return <LoadingCards cover={showThumbnails} />;
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
          /* @TODO uncomment when fav functionality is implemented
          {
            name: 'Favorite',
            label: t('Favorite'),
            onClick: () => {
              getData('Favorite').then(() => setQueryFilter('Favorite'));
            },
          },
          */
          {
            name: 'Mine',
            label: t('Mine'),
            onClick: () => getData('Mine').then(() => setQueryFilter('Mine')),
          },
        ]}
        buttons={[
          {
            name: (
              <>
                <i className="fa fa-plus" />
                {t('SQL Query')}
              </>
            ),
            buttonStyle: 'tertiary',
            onClick: () => {
              window.location.href = '/superset/sqllab?new=true';
            },
          },
          {
            name: t('View All »'),
            buttonStyle: 'link',
            onClick: () => {
              window.location.href = '/savedqueryview/list';
            },
          },
        ]}
      />
      {queries.length > 0 ? (
        <CardContainer showThumbnails={showThumbnails}>
          {queries.map(q => (
            <CardStyles
              onClick={() => {
                window.location.href = `/superset/sqllab?savedQueryId=${q.id}`;
              }}
              key={q.id}
            >
              <ListViewCard
                imgURL=""
                url={`/superset/sqllab?savedQueryId=${q.id}`}
                title={q.label}
                imgFallbackURL="/static/assets/images/empty-query.svg"
                description={t('Ran %s', q.changed_on_delta_humanized)}
                cover={
                  q?.sql?.length && showThumbnails && featureFlag ? (
                    <QueryContainer>
                      <SyntaxHighlighter
                        language="sql"
                        lineProps={{
                          style: {
                            color: 'black',
                            wordBreak: 'break-all',
                            whiteSpace: 'pre-wrap',
                          },
                        }}
                        style={github}
                        wrapLines
                        lineNumberStyle={{
                          display: 'none',
                        }}
                        showLineNumbers={false}
                      >
                        {shortenSQL(q.sql, 25)}
                      </SyntaxHighlighter>
                    </QueryContainer>
                  ) : showThumbnails && !q?.sql?.length ? (
                    false
                  ) : (
                    <></>
                  )
                }
                actions={
                  <QueryData>
                    <ListViewCard.Actions
                      onClick={e => {
                        e.stopPropagation();
                        e.preventDefault();
                      }}
                    >
                      <Dropdown overlay={renderMenu(q)}>
                        <Icons.MoreVert
                          iconColor={theme.colors.grayscale.base}
                        />
                      </Dropdown>
                    </ListViewCard.Actions>
                  </QueryData>
                }
              />
            </CardStyles>
          ))}
        </CardContainer>
      ) : (
        <EmptyState tableName={WelcomeTable.SavedQueries} tab={queryFilter} />
      )}
    </>
  );
};

export default withToasts(SavedQueries);
