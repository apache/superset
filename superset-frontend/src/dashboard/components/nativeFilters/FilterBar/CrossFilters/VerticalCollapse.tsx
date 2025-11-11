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

import { useMemo, useState, useCallback } from 'react';
import { t } from '@superset-ui/core';
import { css, useTheme, SupersetTheme } from '@apache-superset/core/ui';
import { Icons } from '@superset-ui/core/components/Icons';
import { FilterBarOrientation } from 'src/dashboard/types';
import CrossFilter from './CrossFilter';
import { CrossFilterIndicator } from '../../selectors';

const CrossFiltersVerticalCollapse = (props: {
  crossFilters: CrossFilterIndicator[];
  hideHeader?: boolean;
}) => {
  const { crossFilters, hideHeader = false } = props;
  const theme = useTheme();
  const [isOpen, setIsOpen] = useState(true);

  const toggleSection = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);

  const sectionContainerStyle = useCallback(
    (theme: SupersetTheme) => css`
      margin-bottom: ${theme.sizeUnit * 3}px;
      padding: 0 ${theme.sizeUnit * 4}px;
    `,
    [],
  );

  const sectionHeaderStyle = useCallback(
    (theme: SupersetTheme) => css`
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: ${theme.sizeUnit * 2}px 0;
      cursor: pointer;
      user-select: none;

      &:hover {
        background: ${theme.colorBgTextHover};
        margin: 0 -${theme.sizeUnit * 2}px;
        padding: ${theme.sizeUnit * 2}px;
        border-radius: ${theme.borderRadius}px;
      }
    `,
    [],
  );

  const sectionTitleStyle = useCallback(
    (theme: SupersetTheme) => css`
      margin: 0;
      font-size: ${theme.fontSize}px;
      font-weight: ${theme.fontWeightStrong};
      color: ${theme.colorText};
      line-height: 1.3;
    `,
    [],
  );

  const sectionContentStyle = useCallback(
    (theme: SupersetTheme) => css`
      padding: ${theme.sizeUnit * 2}px 0;
    `,
    [],
  );

  const dividerStyle = useCallback(
    (theme: SupersetTheme) => css`
      height: 1px;
      background: ${theme.colorSplit};
      margin: ${theme.sizeUnit * 2}px 0;
    `,
    [],
  );

  const iconStyle = useCallback(
    (isOpen: boolean, theme: SupersetTheme) => css`
      transform: ${isOpen ? 'rotate(0deg)' : 'rotate(180deg)'};
      transition: transform 0.2s ease;
      color: ${theme.colorTextSecondary};
    `,
    [],
  );

  const crossFiltersIndicators = useMemo(
    () =>
      crossFilters.map(filter => (
        <CrossFilter
          key={filter.emitterId}
          filter={filter}
          orientation={FilterBarOrientation.Vertical}
        />
      )),
    [crossFilters],
  );

  if (!crossFilters.length) {
    return null;
  }

  return (
    <div css={sectionContainerStyle}>
      {!hideHeader && (
        <div
          css={sectionHeaderStyle}
          onClick={toggleSection}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              toggleSection();
            }
          }}
          role="button"
          tabIndex={0}
        >
          <h4 css={sectionTitleStyle}>{t('Cross-filters')}</h4>
          <Icons.UpOutlined iconSize="m" css={iconStyle(isOpen, theme)} />
        </div>
      )}
      {isOpen && <div css={sectionContentStyle}>{crossFiltersIndicators}</div>}
      {isOpen && <div css={dividerStyle} data-test="cross-filters-divider" />}
    </div>
  );
};

export default CrossFiltersVerticalCollapse;
