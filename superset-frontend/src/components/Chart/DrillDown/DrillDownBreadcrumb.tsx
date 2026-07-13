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
import { ReactNode } from 'react';
import { css, useTheme } from '@apache-superset/core/theme';
import { t } from '@apache-superset/core/translation';
import { Breadcrumb } from '@superset-ui/core/components';
import { DrillDownLevel } from './types';

interface DrillDownBreadcrumbProps {
  /** Ordered list of column names from the chart's drill-down hierarchy */
  hierarchy: string[];
  /** The drill levels the user has navigated through */
  drillStack: DrillDownLevel[];
  /** Value selected at the deepest level (shown but not clickable) */
  selectedLeaf?: string;
  /** Reset the drill-down to the given depth (0 = back to the start) */
  onJumpTo: (depth: number) => void;
}

/**
 * Compact breadcrumb shown above the chart while the user is drilled into
 * a hierarchy. Clicking any segment jumps back up the stack.
 *
 *   country › USA › region › Texas
 */
export function DrillDownBreadcrumb({
  hierarchy,
  drillStack,
  selectedLeaf,
  onJumpTo,
}: DrillDownBreadcrumbProps) {
  const theme = useTheme();

  if (drillStack.length === 0 && !selectedLeaf) {
    return null;
  }

  const linkCss = css`
    cursor: pointer;
    color: ${theme.colorPrimary};
    &:hover {
      text-decoration: underline;
    }
  `;

  // Render a navigable segment as a keyboard-operable element (role/tabIndex
  // + Enter/Space) since antd's Breadcrumb items are otherwise inert text.
  const clickable = (label: string, depth: number): { title: ReactNode } => ({
    title: (
      <span
        role="button"
        tabIndex={0}
        onClick={() => onJumpTo(depth)}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onJumpTo(depth);
          }
        }}
        css={linkCss}
      >
        {label}
      </span>
    ),
  });

  // Build the breadcrumb trail: the hierarchy root, every drilled level, and
  // the picked leaf (if any). The deepest shown level (last drilled level with
  // no leaf, or the leaf itself) is inert.
  const items: { title: ReactNode }[] = [clickable(hierarchy[0] ?? '', 0)];
  drillStack.forEach((level, index) => {
    const isLast = index === drillStack.length - 1 && !selectedLeaf;
    items.push(
      isLast
        ? { title: <span>{level.label}</span> }
        : clickable(level.label, index + 1),
    );
  });
  if (selectedLeaf) {
    items.push({ title: <span>{selectedLeaf}</span> });
  }

  return (
    <Breadcrumb
      data-test="drill-down-breadcrumb"
      separator={t('›')}
      items={items}
      css={css`
        padding: ${theme.sizeUnit}px ${theme.sizeUnit * 2}px;
        background: ${theme.colorBgContainer};
        border-bottom: 1px solid ${theme.colorBorderSecondary};
        font-size: ${theme.fontSizeSM}px;
      `}
    />
  );
}
