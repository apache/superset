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
import { useEffect, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { t } from '@apache-superset/core/translation';
import { useTheme } from '@apache-superset/core/theme';
import {
  Button,
  type ButtonProps,
  Input,
  PublishedLabel,
} from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import { provider, useDashboardRevision } from 'src/core/dashboard/store';
import LayoutModeSwitcher from './LayoutModeSwitcher';

const NOT_AVAILABLE = t('Not available yet');

/**
 * Header controls, sized down.
 *
 * The bar is chrome around the work rather than the work itself, and every
 * pixel it takes is one the canvas does not get. Driven from the theme's own
 * smallest control step rather than a literal, so it tracks the scale the
 * rest of the app is built on instead of drifting from it.
 */
const compact = (theme: ReturnType<typeof useTheme>) => ({
  height: theme.controlHeightXS,
  paddingInline: theme.sizeUnit * 1.5,
  fontSize: theme.fontSizeSM,
  lineHeight: 1,
});

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
}): ReactElement => {
  const theme = useTheme();
  return (
    <Button
      size="small"
      buttonStyle={buttonStyle}
      disabled
      aria-label={label}
      data-test={test}
      tooltip={`${label} — ${NOT_AVAILABLE}`}
      placement="bottom"
      style={compact(theme)}
    >
      {children}
    </Button>
  );
};

/**
 * The dashboard's name, edited where it is read.
 *
 * It is stored on the root node rather than in this component, because a name
 * is something the dashboard has and not something this screen remembers: put
 * in page state it would be invisible to the assistant, unreachable by the
 * client tools, and gone on the next navigation. The root canvas is the only
 * node a dashboard-level fact can belong to, so that is where it lives.
 *
 * A title is also a `markdown` block an author can place at the top of the
 * canvas, and that stays true — this is a different thing with a different
 * job. That one is content, laid out and arranged like any other block; this
 * one is what the dashboard is called.
 *
 * The draft commits on blur rather than on every keystroke: a name being
 * typed is not a name, and one commit per character would be one revision
 * tick per character for everything subscribed to the store.
 */
const Title = ({ nodeId, title }: { nodeId: string; title: string }) => {
  const theme = useTheme();
  const [draft, setDraft] = useState(title);
  // What was accepted replaces the draft, because the draft was a view of it:
  // a rename the assistant makes while this is on screen has to show.
  useEffect(() => setDraft(title), [title]);

  return (
    <Input
      size="small"
      style={{ maxWidth: 220, height: theme.controlHeightSM }}
      value={draft}
      aria-label={t('Dashboard title')}
      placeholder={t('Untitled dashboard')}
      data-test="header-title"
      onChange={event => setDraft(event.target.value)}
      onBlur={() => {
        const next = draft.trim();
        // An empty name is not a rename. Restoring the draft rather than
        // writing the blank is what keeps a stray select-all-and-delete from
        // silently leaving the dashboard nameless.
        if (next === '') {
          setDraft(title);
        } else if (next !== title) {
          provider.updateProps(nodeId, { title: next });
        }
      }}
    />
  );
};

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
      <Title
        nodeId={root.id}
        title={typeof root.props?.title === 'string' ? root.props.title : ''}
      />
      <Inert label={t('Favorite')} test="header-favorite" buttonStyle="link">
        <Icons.StarOutlined iconSize="m" />
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
          <Icons.ReloadOutlined iconSize="m" />
        </Inert>
        {/* Icons, not words, because these two are reached by muscle memory
            far more often than they are read. The name stays on them for
            anyone not reading with their eyes. */}
        <Inert label={t('Undo')} test="header-undo">
          <Icons.UndoOutlined iconSize="s" />
        </Inert>
        <Inert label={t('Redo')} test="header-redo">
          <Icons.RedoOutlined iconSize="s" />
        </Inert>
        <Inert label={t('Save')} test="header-save">
          {t('Save')}
        </Inert>
      </span>
    </header>
  );
}
