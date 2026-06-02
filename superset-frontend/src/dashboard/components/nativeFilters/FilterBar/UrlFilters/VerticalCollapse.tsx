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

import { useCallback, useMemo, useState } from 'react';
import { t } from '@apache-superset/core/translation';
import { css, useTheme, SupersetTheme } from '@apache-superset/core/theme';
import { Icons } from '@superset-ui/core/components/Icons';
import { FilterBarOrientation } from 'src/dashboard/types';
import UrlFilterTag from './UrlFilterTag';
import { UrlFilterIndicator, getUrlFilterIdentity } from './urlFilterUtils';

const sectionContainerStyle = (theme: SupersetTheme) => css`
  margin-bottom: ${theme.sizeUnit * 3}px;
  padding: 0 ${theme.sizeUnit * 4}px;
`;

const sectionHeaderStyle = (theme: SupersetTheme) => css`
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
`;

const sectionTitleStyle = (theme: SupersetTheme) => css`
  margin: 0;
  font-size: ${theme.fontSize}px;
  font-weight: ${theme.fontWeightStrong};
  color: ${theme.colorText};
  line-height: 1.3;
  display: flex;
  align-items: center;
  gap: ${theme.sizeUnit}px;
`;

const sectionContentStyle = (theme: SupersetTheme) => css`
  padding: ${theme.sizeUnit * 2}px 0;
`;

const dividerStyle = (theme: SupersetTheme) => css`
  height: 1px;
  background: ${theme.colorSplit};
  margin: ${theme.sizeUnit * 2}px 0;
`;

const iconStyle = (open: boolean, theme: SupersetTheme) => css`
  transform: ${open ? 'rotate(0deg)' : 'rotate(180deg)'};
  transition: transform 0.2s ease;
  color: ${theme.colorTextSecondary};
`;

const UrlFiltersVerticalCollapse = (props: {
  urlFilters: UrlFilterIndicator[];
  onRemoveFilter: (filter: UrlFilterIndicator) => void;
}) => {
  const { urlFilters, onRemoveFilter } = props;
  const theme = useTheme();
  const [isOpen, setIsOpen] = useState(true);

  const toggleSection = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);

  const filterIndicators = useMemo(
    () =>
      urlFilters.map(filter => (
        <UrlFilterTag
          key={getUrlFilterIdentity(filter.filter)}
          filter={filter}
          orientation={FilterBarOrientation.Vertical}
          onRemove={onRemoveFilter}
        />
      )),
    [urlFilters, onRemoveFilter],
  );

  if (!urlFilters.length) {
    return null;
  }

  return (
    <div css={sectionContainerStyle}>
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
        <h4 css={sectionTitleStyle}>
          <Icons.LinkOutlined iconSize="s" />
          {t('URL Filters')}
        </h4>
        <Icons.UpOutlined iconSize="m" css={iconStyle(isOpen, theme)} />
      </div>
      {isOpen && <div css={sectionContentStyle}>{filterIndicators}</div>}
      {isOpen && <div css={dividerStyle} data-test="url-filters-divider" />}
    </div>
  );
};

export default UrlFiltersVerticalCollapse;
