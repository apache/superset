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
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ExtraFormData, styled, t } from '@superset-ui/core';
import Popover from 'src/common/components/Popover';
import Icon from 'src/components/Icon';
import { Pill } from 'src/dashboard/components/FiltersBadge/Styles';
import { CascadeFilterControl, FilterControl } from './FilterBar';
import { Filter, CascadeFilter } from './types';

interface CascadePopoverProps {
  filter: CascadeFilter;
  visible: boolean;
  directPathToChild?: string[];
  onVisibleChange: (visible: boolean) => void;
  onExtraFormDataChange: (filter: Filter, extraFormData: ExtraFormData) => void;
}

const StyledTitleBox = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  background-color: ${({ theme }) => theme.colors.grayscale.light4};
  margin: ${({ theme }) => theme.gridUnit * -1}px
    ${({ theme }) => theme.gridUnit * -4}px; // to override default antd padding
  padding: ${({ theme }) => theme.gridUnit * 2}px
    ${({ theme }) => theme.gridUnit * 4}px;

  & > *:last-child {
    cursor: pointer;
  }
`;

const StyledTitle = styled.h4`
  display: flex;
  align-items: center;
  color: ${({ theme }) => theme.colors.grayscale.dark1};
  margin: 0;
  padding: 0;
`;

const StyledIcon = styled(Icon)`
  margin-right: ${({ theme }) => theme.gridUnit}px;
  color: ${({ theme }) => theme.colors.grayscale.dark1};
  width: ${({ theme }) => theme.gridUnit * 4}px;
`;

const StyledPill = styled(Pill)`
  padding: ${({ theme }) => theme.gridUnit}px
    ${({ theme }) => theme.gridUnit * 2}px;
  font-size: ${({ theme }) => theme.typography.sizes.s}px;
  background: ${({ theme }) => theme.colors.grayscale.light1};
`;

const CascadePopover: React.FC<CascadePopoverProps> = ({
  filter,
  visible,
  onVisibleChange,
  onExtraFormDataChange,
  directPathToChild,
}) => {
  const [currentPathToChild, setCurrentPathToChild] = useState<string[]>();

  useEffect(() => {
    setCurrentPathToChild(directPathToChild);
    // clear local copy of directPathToChild after 500ms
    // to prevent triggering multiple focus
    const timeout = setTimeout(() => setCurrentPathToChild(undefined), 500);
    return () => clearTimeout(timeout);
  }, [directPathToChild, setCurrentPathToChild]);

  const getActiveChildren = useCallback((filter: CascadeFilter):
    | CascadeFilter[]
    | null => {
    const children = filter.cascadeChildren || [];
    const currentValue = filter.currentValue || [];

    const activeChildren = children.flatMap(
      childFilter => getActiveChildren(childFilter) || [],
    );

    if (activeChildren.length > 0) {
      return activeChildren;
    }

    if (currentValue.length > 0) {
      return [filter];
    }

    return null;
  }, []);

  const getAllFilters = (filter: CascadeFilter): CascadeFilter[] => {
    const children = filter.cascadeChildren || [];
    const allChildren = children.flatMap(getAllFilters);
    return [filter, ...allChildren];
  };

  const allFilters = getAllFilters(filter);
  const activeFilters = useMemo(() => getActiveChildren(filter) || [filter], [
    filter,
    getActiveChildren,
  ]);

  useEffect(() => {
    const focusedFilterId = currentPathToChild?.[0];
    // filters not directly displayed in the Filter Bar
    const inactiveFilters = allFilters.filter(
      filterEl => !activeFilters.includes(filterEl),
    );
    const focusedInactiveFilter = inactiveFilters.some(
      cascadeChild => cascadeChild.id === focusedFilterId,
    );

    if (focusedInactiveFilter) {
      onVisibleChange(true);
    }
  }, [currentPathToChild]);

  if (!filter.cascadeChildren?.length) {
    return (
      <FilterControl
        filter={filter}
        directPathToChild={directPathToChild}
        onExtraFormDataChange={onExtraFormDataChange}
      />
    );
  }

  const title = (
    <StyledTitleBox>
      <StyledTitle>
        <StyledIcon name="edit" />
        {t('Select parent filters')} ({allFilters.length})
      </StyledTitle>
      <StyledIcon name="close" onClick={() => onVisibleChange(false)} />
    </StyledTitleBox>
  );

  const content = (
    <CascadeFilterControl
      data-test="cascade-filters-control"
      key={filter.id}
      filter={filter}
      directPathToChild={visible ? currentPathToChild : undefined}
      onExtraFormDataChange={onExtraFormDataChange}
    />
  );

  return (
    <Popover
      content={content}
      title={title}
      trigger="click"
      visible={visible}
      onVisibleChange={onVisibleChange}
      placement="rightTop"
      id={filter.id}
      overlayStyle={{ minWidth: '400px', maxWidth: '600px' }}
    >
      <div>
        {activeFilters.map(activeFilter => (
          <FilterControl
            key={activeFilter.id}
            filter={activeFilter}
            onExtraFormDataChange={onExtraFormDataChange}
            directPathToChild={currentPathToChild}
            icon={
              <>
                {filter.cascadeChildren.length !== 0 && (
                  <StyledPill onClick={() => onVisibleChange(true)}>
                    <Icon name="filter" /> {allFilters.length}
                  </StyledPill>
                )}
              </>
            }
          />
        ))}
      </div>
    </Popover>
  );
};

export default CascadePopover;
