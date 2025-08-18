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
import { useMemo, FC } from 'react';

import { bindActionCreators } from 'redux';
import { useSelector, useDispatch, shallowEqual } from 'react-redux';
import { MenuDotsDropdown } from '@superset-ui/core/components';
import { Menu, MenuItemType } from '@superset-ui/core/components/Menu';
import {
  styled,
  css,
  t,
  QueryState,
  SupersetTheme,
  useTheme,
} from '@superset-ui/core';
import {
  removeQueryEditor,
  removeAllOtherQueryEditors,
  queryEditorSetTitle,
  cloneQueryToNewTab,
  toggleLeftBar,
} from 'src/SqlLab/actions/sqlLab';
import { QueryEditor, SqlLabRootState } from 'src/SqlLab/types';
import { Icons, type IconType } from '@superset-ui/core/components/Icons';

const TabTitleWrapper = styled.div`
  display: flex;
  align-items: center;

  [aria-label='check-circle'],
  .status-icon {
    margin: 0px;
  }
`;
const TabTitle = styled.span`
  margin-right: ${({ theme }) => theme.sizeUnit * 2}px;
  text-transform: none;
`;

const IconContainer = styled.div`
  ${({ theme }) => css`
    display: inline-block;
    margin: 0 ${theme.sizeUnit * 2}px 0 0px;
  `}
`;
interface Props {
  queryEditor: QueryEditor;
}

const STATE_ICONS: Record<string, FC<IconType>> = {
  started: Icons.CircleSolid,
  stopped: Icons.StopOutlined,
  pending: Icons.CircleSolid,
  scheduled: Icons.CalendarOutlined,
  fetching: Icons.CircleSolid,
  timedOut: Icons.FieldTimeOutlined,
  running: Icons.CircleSolid,
  success: Icons.CheckCircleOutlined,
  failed: Icons.CloseCircleOutlined,
};

const SqlEditorTabHeader: FC<Props> = ({ queryEditor }) => {
  const theme = useTheme();
  const qe = useSelector<SqlLabRootState, QueryEditor>(
    ({ sqlLab: { unsavedQueryEditor } }) => ({
      ...queryEditor,
      ...(queryEditor.id === unsavedQueryEditor?.id && unsavedQueryEditor),
    }),
    shallowEqual,
  );
  const queryState = useSelector<SqlLabRootState, QueryState>(
    ({ sqlLab }) => sqlLab.queries[qe.latestQueryId || '']?.state || '',
  );
  const StatusIcon = queryState ? STATE_ICONS[queryState] : STATE_ICONS.running;

  const dispatch = useDispatch();
  const actions = useMemo(
    () =>
      bindActionCreators(
        {
          removeQueryEditor,
          removeAllOtherQueryEditors,
          queryEditorSetTitle,
          cloneQueryToNewTab,
          toggleLeftBar,
        },
        dispatch,
      ),
    [dispatch],
  );

  function renameTab() {
    const newTitle = prompt(t('Enter a new title for the tab'));
    if (newTitle) {
      actions.queryEditorSetTitle(qe, newTitle, qe.id);
    }
  }
  const getStatusColor = (state: QueryState, theme: SupersetTheme): string => {
    const statusColors: Record<QueryState, string> = {
      [QueryState.Running]: theme.colorInfo,
      [QueryState.Success]: theme.colorSuccess,
      [QueryState.Failed]: theme.colorError,
      [QueryState.Started]: theme.colorPrimary,
      [QueryState.Stopped]: theme.colorWarning,
      [QueryState.Pending]: theme.colorIcon,
      [QueryState.Scheduled]: theme.colorIcon,
      [QueryState.Fetching]: theme.colorWarning,
      [QueryState.TimedOut]: theme.colorError,
    };

    return statusColors[state] || theme.colorIcon;
  };
  return (
    <TabTitleWrapper>
      <MenuDotsDropdown
        trigger={['click']}
        overlay={
          <Menu
            items={[
              {
                className: 'close-btn',
                key: '1',
                onClick: () => actions.removeQueryEditor(qe),
                'data-test': 'close-tab-menu-option',
                label: (
                  <>
                    <IconContainer>
                      <Icons.CloseOutlined
                        iconSize="l"
                        css={css`
                          verticalalign: middle;
                        `}
                      />
                    </IconContainer>
                    {t('Close tab')}
                  </>
                ),
              } as MenuItemType,
              {
                key: '2',
                onClick: renameTab,
                'data-test': 'rename-tab-menu-option',
                label: (
                  <>
                    <IconContainer>
                      <Icons.EditOutlined
                        css={css`
                          verticalalign: middle;
                        `}
                        iconSize="l"
                      />
                    </IconContainer>
                    {t('Rename tab')}
                  </>
                ),
              } as MenuItemType,
              {
                key: '3',
                onClick: () => actions.toggleLeftBar(qe),
                'data-test': 'toggle-menu-option',
                label: (
                  <>
                    <IconContainer>
                      <Icons.VerticalAlignBottomOutlined
                        iconSize="l"
                        css={css`
                          rotate: ${qe.hideLeftBar ? '-90deg;' : '90deg;'};
                        `}
                      />
                    </IconContainer>
                    {qe.hideLeftBar ? t('Expand tool bar') : t('Hide tool bar')}
                  </>
                ),
              } as MenuItemType,
              {
                key: '4',
                onClick: () => actions.removeAllOtherQueryEditors(qe),
                'data-test': 'close-all-other-menu-option',
                label: (
                  <>
                    <IconContainer>
                      <Icons.CloseOutlined
                        iconSize="l"
                        css={css`
                          vertical-align: middle;
                        `}
                      />
                    </IconContainer>
                    {t('Close all other tabs')}
                  </>
                ),
              } as MenuItemType,
              {
                key: '5',
                onClick: () => actions.cloneQueryToNewTab(qe, false),
                'data-test': 'clone-tab-menu-option',
                label: (
                  <>
                    <IconContainer>
                      <Icons.CopyOutlined
                        iconSize="l"
                        css={css`
                          vertical-align: middle;
                        `}
                      />
                    </IconContainer>
                    {t('Duplicate tab')}
                  </>
                ),
              } as MenuItemType,
            ]}
          />
        }
      />
      <TabTitle>{qe.name}</TabTitle>{' '}
      <StatusIcon
        className="status-icon"
        iconSize="m"
        iconColor={getStatusColor(queryState, theme)}
      />{' '}
    </TabTitleWrapper>
  );
};

export default SqlEditorTabHeader;
