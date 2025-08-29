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
import { useCallback, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { styled, SupersetClient, t, useTheme, css } from '@superset-ui/core';
import CodeSyntaxHighlighter, {
  preloadLanguages,
} from '@superset-ui/core/components/CodeSyntaxHighlighter';
import { LoadingCards } from 'src/pages/Home';
import { TableTab } from 'src/views/CRUD/types';
import withToasts from 'src/components/MessageToasts/withToasts';
import {
  Dropdown,
  DeleteModal,
  Button,
  ListViewCard,
} from '@superset-ui/core/components';
import { MenuItem } from '@superset-ui/core/components/Menu';
import { copyQueryLink, useListViewResource } from 'src/views/CRUD/hooks';
import { Icons } from '@superset-ui/core/components/Icons';
import { User } from 'src/types/bootstrapTypes';
import {
  CardContainer,
  createErrorHandler,
  getFilterValues,
  PAGE_SIZE,
  shortenSQL,
} from 'src/views/CRUD/utils';
import { assetUrl } from 'src/utils/assetUrl';
import { ensureAppRoot } from 'src/utils/pathUtils';
import { navigateTo } from 'src/utils/navigationUtils';
import SubMenu from './SubMenu';
import EmptyState from './EmptyState';
import { WelcomeTable } from './types';

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
    border-bottom: 1px solid ${({ theme }) => theme.colorBorder};
    & > div {
      height: 171px;
    }
  }
  .gradient-container > div {
    background-size: contain;
    background-repeat: no-repeat;
    background-position: center;
    background-color: ${({ theme }) => theme.colorPrimaryBg};
    display: inline-block;
    width: 100%;
    height: 179px;
    background-repeat: no-repeat;
    vertical-align: middle;
  }
`;

const QueryData = styled.div`
  svg {
    margin-left: ${({ theme }) => theme.sizeUnit * 10}px;
  }
  .query-title {
    padding: ${({ theme }) => theme.sizeUnit * 2 + 2}px;
    font-size: ${({ theme }) => theme.fontSizeLG}px;
  }
`;

const QueryContainer = styled.div`
  /* Custom styles for the syntax highlighter in cards */
  & > div {
    height: ${({ theme }) => theme.sizeUnit * 40}px;
    border: none !important;
    overflow: hidden !important;

    pre {
      height: 100%;
      margin: 0;
      border: none;
      overflow: hidden;
      word-break: break-all;
      white-space: pre-wrap;
    }
  }
`;

export const SavedQueries = ({
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

  // Preload SQL language since we'll likely show SQL snippets
  useEffect(() => {
    if (showThumbnails && featureFlag) {
      preloadLanguages(['sql']);
    }
  }, [showThumbnails, featureFlag]);

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

  const menuItems = useCallback((query: Query) => {
    const menuItems: MenuItem[] = [];
    if (canEdit) {
      menuItems.push({
        key: 'edit',
        label: <Link to={`/sqllab?savedQueryId=${query.id}`}>{t('Edit')}</Link>,
      });
    }
    menuItems.push({
      key: 'share-query',
      label: (
        <>
          <Icons.UploadOutlined
            iconSize="l"
            css={css`
              margin-right: ${theme.sizeUnit}px;
              vertical-align: baseline;
            `}
          />
          {t('Share')}
        </>
      ),
      onClick: () => {
        if (query.id) {
          copyQueryLink(query.id, addDangerToast, addSuccessToast);
        }
      },
    });

    if (canDelete) {
      menuItems.push({
        key: 'delete-query',
        label: t('Delete'),
        onClick: () => {
          setQueryDeleteModal(true);
          setCurrentlyEdited(query);
        },
      });
    }
    return menuItems;
  }, []);

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
        backgroundColor="transparent"
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
            icon: <Icons.PlusOutlined iconSize="m" />,
            name: (
              <Link
                to="/sqllab?new=true"
                css={css`
                  &:hover {
                    color: currentColor;
                    text-decoration: none;
                  }
                `}
              >
                {t('SQL Query')}
              </Link>
            ),
            buttonStyle: 'secondary',
          },
          {
            name: t('View All »'),
            buttonStyle: 'link',
            onClick: () => {
              navigateTo('/savedqueryview/list');
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
                url={ensureAppRoot(`/sqllab?savedQueryId=${q.id}`)}
                title={q.label}
                imgFallbackURL={assetUrl(
                  '/static/assets/images/empty-query.svg',
                )}
                description={t('Modified %s', q.changed_on_delta_humanized)}
                cover={
                  q?.sql?.length && showThumbnails && featureFlag ? (
                    <QueryContainer>
                      <CodeSyntaxHighlighter
                        language="sql"
                        showLineNumbers={false}
                        wrapLines
                        customStyle={{
                          height: theme.sizeUnit * 40,
                          border: 'none',
                          overflow: 'hidden',
                          color: theme.colorText,
                          wordBreak: 'break-all',
                          whiteSpace: 'pre-wrap',
                        }}
                      >
                        {shortenSQL(q.sql, 25)}
                      </CodeSyntaxHighlighter>
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
                      <Dropdown
                        menu={{
                          items: menuItems(q),
                        }}
                        trigger={['click', 'hover']}
                      >
                        <Button buttonSize="xsmall" buttonStyle="link">
                          <Icons.MoreOutlined iconColor={theme.colorText} />
                        </Button>
                      </Dropdown>
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
