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
import type { ReactElement } from 'react';
import { t } from '@apache-superset/core/translation';
import { useTheme } from '@apache-superset/core/theme';
import { views } from 'src/core/views';
import { DASHBOARD_BUILDING_BLOCKS_LOCATION } from 'src/core/dashboard/resolveBuildingBlockView';
import { provider, useDashboardRevision } from 'src/core/dashboard/store';

/** How long a label may run before it is cut. */
const LABEL_LIMIT = 40;

/**
 * What a node is called in the outline.
 *
 * A registered block's own name first, because that is what the author chose
 * it by in the palette. Markdown gets its opening words instead — a list of
 * five rows all reading "Markdown" identifies nothing, and the content is the
 * only thing that tells them apart.
 */
const labelOf = (type: string, props: Record<string, unknown> | undefined) => {
  const content = props?.content;
  if (typeof content === 'string' && content.trim() !== '') {
    const text = content.trim().replace(/\s+/g, ' ');
    return text.length > LABEL_LIMIT ? `${text.slice(0, LABEL_LIMIT)}…` : text;
  }
  const registered = views
    .getViews(DASHBOARD_BUILDING_BLOCKS_LOCATION)
    ?.find(view => view.id === type);
  return registered?.name ?? type;
};

const Row = ({
  nodeId,
  depth,
}: {
  nodeId: string;
  depth: number;
}): ReactElement | null => {
  const theme = useTheme();
  const node = provider.getNode(nodeId);
  if (!node) {
    return null;
  }
  const selected = provider.getSelection() === nodeId;
  const children = node.children ?? [];

  return (
    <li role="none">
      <div
        role="treeitem"
        aria-level={depth + 1}
        aria-selected={selected}
        tabIndex={selected ? 0 : -1}
        data-test={`outline-row-${nodeId}`}
        onClick={() => provider.setSelection(nodeId)}
        onKeyDown={event => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            provider.setSelection(nodeId);
          }
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: theme.sizeUnit,
          padding: `${theme.sizeUnit / 2}px ${theme.sizeUnit}px`,
          paddingLeft: theme.sizeUnit * (1 + depth * 3),
          borderRadius: theme.borderRadius,
          fontSize: theme.fontSizeSM,
          color: selected ? theme.colorPrimaryText : theme.colorText,
          background: selected ? theme.colorPrimaryBg : undefined,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {labelOf(node.type, node.props)}
      </div>
      {children.length > 0 && (
        <ul
          // The tags the rule suggests are document sections, not tree
          // structure. `group` inside `tree` is the pattern WAI-ARIA
          // specifies for a treeitem's children, and a screen reader's tree
          // navigation reads it — no semantic element means this.
          // eslint-disable-next-line jsx-a11y/prefer-tag-over-role
          role="group"
          style={{ listStyle: 'none', margin: 0, padding: 0 }}
        >
          {children.map(childId => (
            <Row key={childId} nodeId={childId} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
};

/**
 * The dashboard's structure, as something to read and to reach into.
 *
 * The canvas shows what a dashboard looks like; this shows what it is made
 * of. That matters most for exactly the blocks the canvas is worst at
 * offering — one nested inside a container, one scrolled out of view, one
 * sized so small there is nothing to click.
 *
 * Choosing a row selects it and leaves the author here. Reading a structure
 * means going through it, and a panel that ejected to Properties on the first
 * row would hide the very row it had just marked as selected.
 */
export default function Outline(): ReactElement {
  useDashboardRevision();
  const theme = useTheme();
  const root = provider.getRoot();
  const children = root.children ?? [];

  if (children.length === 0) {
    return (
      <p
        data-test="outline-empty"
        style={{ color: theme.colorTextTertiary, fontSize: theme.fontSizeSM }}
      >
        {t('Nothing on the dashboard yet.')}
      </p>
    );
  }

  return (
    <ul
      role="tree"
      aria-label={t('Dashboard outline')}
      data-test="outline"
      style={{ listStyle: 'none', margin: 0, padding: 0 }}
    >
      {children.map(childId => (
        <Row key={childId} nodeId={childId} depth={0} />
      ))}
    </ul>
  );
}
