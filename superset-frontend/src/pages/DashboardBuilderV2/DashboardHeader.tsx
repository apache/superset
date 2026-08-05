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
import type { ReactElement, ReactNode } from 'react';
import { t } from '@apache-superset/core/translation';
import { useTheme } from '@apache-superset/core/theme';
import {
  Button,
  type ButtonProps,
  PublishedLabel,
} from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import { provider, useDashboardRevision } from 'src/core/dashboard/store';
import LayoutModeSwitcher from './LayoutModeSwitcher';

const NOT_AVAILABLE = t('Not available yet');

/**
 * An affordance that is present, named and honest about not working.
 *
 * Most of this header is one. The builder keeps its tree in memory and has
 * no dashboard row behind it: nothing here can be saved, favourited,
 * published or refreshed, and there is no history to step through. Drawing
 * them disabled says which parts of the product this page is still missing;
 * drawing them live and inert would teach something false about all of them.
 *
 * `Button` renders a disabled control inside a span so its tooltip survives —
 * a bare disabled button swallows the pointer events a tooltip listens for,
 * and the explanation would never reach the one control that needs it.
 */
const Inert = ({
  label,
  test,
  buttonStyle,
  children,
}: {
  label: string;
  test: string;
  buttonStyle?: ButtonProps['buttonStyle'];
  children: ReactNode;
}): ReactElement => (
  <Button
    size="small"
    buttonStyle={buttonStyle}
    disabled
    aria-label={label}
    data-test={test}
    tooltip={`${label} — ${NOT_AVAILABLE}`}
    placement="bottom"
  >
    {children}
  </Button>
);

/**
 * The dashboard's header: what this dashboard is, and what can be done to it.
 *
 * Two kinds of thing share the bar. On the left is the dashboard as the
 * product would know it — where to start from, where it has been, whether it
 * is published. On the right is what an author does to the tree in front of
 * them, and the one live control among them is the layout: it is the only one
 * whose state is in the tree rather than in a row this page does not have.
 */
export default function DashboardHeader(): ReactElement {
  useDashboardRevision();
  const theme = useTheme();
  const root = provider.getRoot();

  return (
    <header
      data-test="dashboard-header"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: theme.sizeUnit * 2,
        flex: '0 0 auto',
        padding: theme.sizeUnit * 2,
        borderBottom: `1px solid ${theme.colorBorder}`,
        background: theme.colorBgContainer,
      }}
    >
      {/* Where this dashboard came from and where it has been: one offers a
          starting point to build from, the other the record of what has
          already happened to it. Both are asked before the work rather than
          during it, which is why they lead the bar. */}
      <Inert label={t('Templates')} test="header-templates">
        {t('Templates')}
      </Inert>
      <Inert label={t('History')} test="header-history">
        {t('History')}
      </Inert>
      <Inert label={t('Favorite')} test="header-favorite" buttonStyle="link">
        <Icons.StarOutlined iconSize="l" />
      </Inert>
      {/* Nothing here can publish, so the chip states the only status this
          page can honestly claim. */}
      <span data-test="header-published">
        <PublishedLabel isPublished={false} />
      </span>

      <span
        style={{
          marginLeft: 'auto',
          display: 'flex',
          alignItems: 'center',
          gap: theme.sizeUnit * 2,
        }}
      >
        <LayoutModeSwitcher nodeId={root.id} />
        <Inert
          label={t('Refresh dashboard')}
          test="header-refresh"
          buttonStyle="link"
        >
          <Icons.ReloadOutlined iconSize="l" />
        </Inert>
        {/* Icons, not words, because these two are reached by muscle memory
            far more often than they are read. The name stays on them for
            anyone not reading with their eyes. */}
        <Inert label={t('Undo')} test="header-undo">
          <Icons.UndoOutlined iconSize="m" />
        </Inert>
        <Inert label={t('Redo')} test="header-redo">
          <Icons.RedoOutlined iconSize="m" />
        </Inert>
        <Inert label={t('Save')} test="header-save">
          {t('Save')}
        </Inert>
      </span>
    </header>
  );
}
