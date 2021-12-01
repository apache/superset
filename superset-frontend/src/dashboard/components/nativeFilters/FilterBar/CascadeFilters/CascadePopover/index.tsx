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
import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useRef,
} from 'react';
import { styled, t, DataMask, css, SupersetTheme } from '@superset-ui/core';
import Popover from 'src/components/Popover';
import Icons from 'src/components/Icons';
import { Pill } from 'src/dashboard/components/FiltersBadge/Styles';
import { DataMaskStateWithId } from 'src/dataMask/types';
import FilterControl from 'src/dashboard/components/nativeFilters/FilterBar/FilterControls/FilterControl';
import CascadeFilterControl from 'src/dashboard/components/nativeFilters/FilterBar/CascadeFilters/CascadeFilterControl';
import { CascadeFilter } from 'src/dashboard/components/nativeFilters/FilterBar/CascadeFilters/types';
import { Filter } from 'src/dashboard/components/nativeFilters/types';

interface CascadePopoverProps {
  dataMaskSelected: DataMaskStateWithId;
  filter: CascadeFilter;
  visible: boolean;
  directPathToChild?: string[];
  inView?: boolean;
  onVisibleChange: (visible: boolean) => void;
  onFilterSelectionChange: (filter: Filter, dataMask: DataMask) => void;
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

const IconStyles = (theme: SupersetTheme) => css`
  margin-right: ${theme.gridUnit}px;
  color: ${theme.colors.grayscale.dark1};
  width: ${theme.gridUnit * 4}px;
`;

const StyledPill = styled(Pill)`
  padding: ${({ theme }) => theme.gridUnit}px
    ${({ theme }) => theme.gridUnit * 2}px;
  font-size: ${({ theme }) => theme.typography.sizes.s}px;
  background: ${({ theme }) => theme.colors.grayscale.light1};
`;

const ContentStyles = styled.div`
  max-height: 700px;
  overflow: auto;
`;

const CascadePopover: React.FC<CascadePopoverProps> = ({
  dataMaskSelected,
  filter,
  visible,
  onVisibleChange,
  onFilterSelectionChange,
  directPathToChild,
  inView,
}) => {
  const [currentPathToChild, setCurrentPathToChild] = useState<string[]>();
  const dataMask = dataMaskSelected[filter.id];
  const parent = useRef();

  useEffect(() => {
    setCurrentPathToChild(directPathToChild);
    // clear local copy of directPathToChild after 500ms
    // to prevent triggering multiple focus
    const timeout = setTimeout(() => setCurrentPathToChild(undefined), 500);
    return () => clearTimeout(timeout);
  }, [directPathToChild, setCurrentPathToChild]);

  const getActiveChildren = useCallback(
    (filter: CascadeFilter): CascadeFilter[] | null => {
      const children = filter.cascadeChildren || [];
      const currentValue = dataMask?.filterState?.value;

      const activeChildren = children.flatMap(
        childFilter => getActiveChildren(childFilter) || [],
      );

      if (activeChildren.length > 0) {
        return activeChildren;
      }

      if (currentValue !== undefined && currentValue !== null) {
        return [filter];
      }

      return null;
    },
    [dataMask],
  );

  const getAllFilters = (filter: CascadeFilter): CascadeFilter[] => {
    const children = filter.cascadeChildren || [];
    const allChildren = children.flatMap(getAllFilters);
    return [filter, ...allChildren];
  };

  const allFilters = getAllFilters(filter);
  const activeFilters = useMemo(
    () => getActiveChildren(filter) || [filter],
    [filter, getActiveChildren],
  );

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
        dataMaskSelected={dataMaskSelected}
        filter={filter}
        directPathToChild={directPathToChild}
        onFilterSelectionChange={onFilterSelectionChange}
        inView={inView}
      />
    );
  }

  const title = (
    <StyledTitleBox>
      <StyledTitle>
        <Icons.Edit
          iconSize="l"
          css={(theme: SupersetTheme) => IconStyles(theme)}
        />
        {t('Select parent filters')} ({allFilters.length})
      </StyledTitle>
      <Icons.Close
        iconSize="l"
        css={(theme: SupersetTheme) => IconStyles(theme)}
        onClick={() => onVisibleChange(false)}
      />
    </StyledTitleBox>
  );

  const content = (
    <ContentStyles>
      <CascadeFilterControl
        dataMaskSelected={dataMaskSelected}
        data-test="cascade-filters-control"
        key={filter.id}
        filter={filter}
        directPathToChild={visible ? currentPathToChild : undefined}
        onFilterSelectionChange={onFilterSelectionChange}
        parentRef={parent}
      />
    </ContentStyles>
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
      overlayStyle={{
        width: '400px',
        position: 'relative',
        overflow: 'auto',
      }}
      ref={parent}
    >
      <div>
        {activeFilters.map(activeFilter => (
          <FilterControl
            dataMaskSelected={dataMaskSelected}
            key={activeFilter.id}
            filter={activeFilter}
            onFilterSelectionChange={onFilterSelectionChange}
            directPathToChild={currentPathToChild}
            inView={inView}
            icon={
              <>
                {filter.cascadeChildren.length !== 0 && (
                  <StyledPill onClick={() => onVisibleChange(true)}>
                    <Icons.Filter iconSize="m" /> {allFilters.length}
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
export default React.memo(CascadePopover);
