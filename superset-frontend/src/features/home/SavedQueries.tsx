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
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { styled, SupersetClient, t, useTheme } from '@superset-ui/core';
import SyntaxHighlighter from 'react-syntax-highlighter/dist/cjs/light';
import sql from 'react-syntax-highlighter/dist/cjs/languages/hljs/sql';
import github from 'react-syntax-highlighter/dist/cjs/styles/hljs/github';
import { LoadingCards } from 'src/pages/Home';
import { TableTab } from 'src/views/CRUD/types';
import withToasts from 'src/components/MessageToasts/withToasts';
import { AntdDropdown } from 'src/components';
import { Menu } from 'src/components/Menu';
import { copyQueryLink, useListViewResource } from 'src/views/CRUD/hooks';
import ListViewCard from 'src/components/ListViewCard';
import DeleteModal from 'src/components/DeleteModal';
import Icons from 'src/components/Icons';
import { User } from 'src/types/bootstrapTypes';
import {
  CardContainer,
  createErrorHandler,
  getFilterValues,
  PAGE_SIZE,
  shortenSQL,
} from 'src/views/CRUD/utils';
import SubMenu from './SubMenu';
import EmptyState from './EmptyState';
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
  user: User;
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
  const [activeTab, setActiveTab] = useState(TableTab.Mine);
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
          filters: getFilterValues(
            TableTab.Created,
            WelcomeTable.SavedQueries,
            user,
          ),
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

  const getData = (tab: TableTab) =>
    fetchData({
      pageIndex: 0,
      pageSize: PAGE_SIZE,
      sortBy: [
        {
          id: 'changed_on_delta_humanized',
          desc: true,
        },
      ],
      filters: getFilterValues(tab, WelcomeTable.SavedQueries, user),
    });

  const renderMenu = (query: Query) => (
    <Menu>
      {canEdit && (
        <Menu.Item>
          <Link to={`/sqllab?savedQueryId=${query.id}`}>{t('Edit')}</Link>
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
        activeChild={activeTab}
        tabs={[
          {
            name: TableTab.Mine,
            label: t('Mine'),
            onClick: () =>
              getData(TableTab.Mine).then(() => setActiveTab(TableTab.Mine)),
          },
        ]}
        buttons={[
          {
            name: (
              <Link to="/sqllab?new=true">
                <i className="fa fa-plus" />
                {t('SQL Query')}
              </Link>
            ),
            buttonStyle: 'tertiary',
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
            <CardStyles key={q.id}>
              <ListViewCard
                imgURL=""
                url={`/sqllab?savedQueryId=${q.id}`}
                title={q.label}
                imgFallbackURL="/static/assets/images/empty-query.svg"
                description={t('Modified %s', q.changed_on_delta_humanized)}
                cover={
                  q?.sql?.length && showThumbnails && featureFlag ? (
                    <QueryContainer>
                      <SyntaxHighlighter
                        language="sql"
                        lineProps={{
                          style: {
                            color: theme.colors.grayscale.dark2,
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
                      <AntdDropdown overlay={renderMenu(q)}>
                        <Icons.MoreVert
                          iconColor={theme.colors.grayscale.base}
                        />
                      </AntdDropdown>
                    </ListViewCard.Actions>
                  </QueryData>
                }
              />
            </CardStyles>
          ))}
        </CardContainer>
      ) : (
        <EmptyState tableName={WelcomeTable.SavedQueries} tab={activeTab} />
      )}
    </>
  );
};

export default withToasts(SavedQueries);
