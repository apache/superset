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
import { ReactNode, useContext, useRef, useState } from 'react';
import { t } from '@apache-superset/core/translation';
import { css, styled, useTheme } from '@apache-superset/core/theme';
import {
  Button,
  ModalTrigger,
  NoAnimationDropdown,
} from '@superset-ui/core/components';
import type { ModalTriggerRef } from '@superset-ui/core/components/ModalTrigger';
import { Icons } from '@superset-ui/core/components/Icons';
import { Menu, MenuItem } from '@superset-ui/core/components/Menu';
import type { SupportedLanguage } from '@superset-ui/core/components/CodeSyntaxHighlighter';
import ViewQuery from 'src/explore/components/controls/ViewQuery';
import { CanvasDraftContext } from './useWidgetRows';

const Frame = styled.div<{ editing?: boolean }>`
  ${({ theme, editing }) => css`
    position: relative;
    height: 100%;

    .canvas-widget-controls {
      position: absolute;
      top: 0;
      /*
       * While a plan is open the top right corner belongs to the layout's
       * resize handle, so these controls step aside by its width. Without
       * that the handle would either sit under them or have to be pushed
       * out of the corner, where it no longer matches the other three.
       */
      right: ${editing ? theme.sizeUnit * 5 : 0}px;
      z-index: 1;
      opacity: 0;
    }

    &:hover .canvas-widget-controls,
    &:focus-within .canvas-widget-controls,
    .canvas-widget-controls.ant-dropdown-open {
      opacity: 1;
    }
  `}
`;

const VIEW_QUERY = 'view_query';
const LANGUAGES: SupportedLanguage[] = ['sql', 'htmlbars', 'markdown', 'json'];

export interface WithQueryProps {
  /** The query that produced the widget's data, when the user may see it. */
  query?: string;
  language?: string;
  /** The widget's dataset, `<id>__table`, for opening the query in SQL Lab. */
  datasource?: string;
  children: ReactNode;
}

/**
 * A data widget with the dashboard chart menu, holding "View query": the
 * query its data came from, as the server ran it for this user, current
 * filters and row level security included.
 */
export default function WithQuery({
  query,
  language,
  datasource = '',
  children,
}: WithQueryProps) {
  const theme = useTheme();
  // A plan is open, so the layout's resize handle owns the top right corner.
  const editing = Boolean(useContext(CanvasDraftContext));
  const [open, setOpen] = useState(false);
  const queryModal = useRef<ModalTriggerRef['current']>(null);
  if (!query) return <>{children}</>;

  const items: MenuItem[] = [
    {
      key: VIEW_QUERY,
      label: (
        <ModalTrigger
          ref={queryModal}
          triggerNode={
            <div data-test="view-query-menu-item">{t('View query')}</div>
          }
          modalTitle={t('View query')}
          modalBody={
            <ViewQuery
              sql={query}
              datasource={datasource}
              language={
                LANGUAGES.find(supported => supported === language) ?? 'sql'
              }
            />
          }
          draggable
          resizable
          responsive
        />
      ),
    },
  ];

  return (
    <Frame editing={editing}>
      {children}
      <NoAnimationDropdown
        popupRender={() => (
          <Menu
            selectable={false}
            items={items}
            onClick={({ key, domEvent }) => {
              if (key === VIEW_QUERY && !queryModal.current?.showModal) {
                queryModal.current?.open(domEvent);
              }
              setOpen(false);
            }}
          />
        )}
        trigger={['click']}
        placement="bottomRight"
        open={open}
        onOpenChange={setOpen}
      >
        <Button
          className="canvas-widget-controls"
          buttonStyle="link"
          aria-label={t('More Options')}
          aria-haspopup="true"
          css={css`
            width: ${theme.sizeUnit * 8}px;
            height: ${theme.sizeUnit * 8}px;
            padding: 0;
          `}
        >
          <Icons.EllipsisOutlined
            iconSize="xl"
            css={css`
              transform: rotate(90deg);
            `}
          />
        </Button>
      </NoAnimationDropdown>
    </Frame>
  );
}
