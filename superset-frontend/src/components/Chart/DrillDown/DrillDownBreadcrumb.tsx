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
import { useCallback } from 'react';
import { css, useTheme } from '@apache-superset/core/theme';
import { t } from '@apache-superset/core/translation';
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

  const handleClick = useCallback(
    (depth: number) => (e: React.MouseEvent) => {
      e.preventDefault();
      onJumpTo(depth);
    },
    [onJumpTo],
  );

  if (drillStack.length === 0 && !selectedLeaf) {
    return null;
  }

  const separatorCss = css`
    color: ${theme.colorTextTertiary};
    margin: 0 ${theme.sizeUnit / 2}px;
  `;

  // Native <button> reset to render as an inline link — keeps built-in
  // keyboard/focus a11y without hand-rolled role/tabIndex/onKeyDown.
  const linkCss = css`
    cursor: pointer;
    color: ${theme.colorPrimary};
    background: none;
    border: none;
    padding: 0;
    font: inherit;
    line-height: inherit;
    &:hover {
      text-decoration: underline;
    }
  `;

  return (
    <div
      data-test="drill-down-breadcrumb"
      css={css`
        padding: ${theme.sizeUnit}px ${theme.sizeUnit * 2}px;
        background: ${theme.colorBgContainer};
        border-bottom: 1px solid ${theme.colorBorderSecondary};
        font-size: ${theme.fontSizeSM}px;
        display: flex;
        align-items: center;
        gap: ${theme.sizeUnit}px;
        flex-wrap: wrap;
      `}
    >
      <button type="button" onClick={handleClick(0)} css={linkCss}>
        {hierarchy[0] ?? ''}
      </button>
      {drillStack.map((level, index) => {
        const isLast = index === drillStack.length - 1 && !selectedLeaf;
        return (
          <span key={`${index}-${level.label}`}>
            <span css={separatorCss}>{t('›')}</span>
            {isLast ? (
              <span>{level.label}</span>
            ) : (
              <button
                type="button"
                onClick={handleClick(index + 1)}
                css={linkCss}
              >
                {level.label}
              </button>
            )}
          </span>
        );
      })}
      {selectedLeaf && (
        <span>
          <span css={separatorCss}>{t('›')}</span>
          <span>{selectedLeaf}</span>
        </span>
      )}
    </div>
  );
}
