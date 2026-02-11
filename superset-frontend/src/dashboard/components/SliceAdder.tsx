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
/* eslint-env browser */
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';
import { FixedSizeList as List } from 'react-window';
// @ts-expect-error
import { createFilter } from 'react-search-input';
import { t } from '@apache-superset/core';
import { styled, css, useTheme } from '@apache-superset/core/ui';
import {
  Button,
  Checkbox,
  InfoTooltip,
  Input,
  Loading,
  Select,
} from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import {
  LocalStorageKeys,
  getItem,
  setItem,
} from 'src/utils/localStorageHelpers';
import {
  CHART_TYPE,
  NEW_COMPONENT_SOURCE_TYPE,
} from 'src/dashboard/util/componentTypes';
import {
  NEW_CHART_ID,
  NEW_COMPONENTS_SOURCE_ID,
} from 'src/dashboard/util/constants';
import { debounce, pickBy } from 'lodash';
import { Dispatch } from 'redux';
import { Slice } from 'src/dashboard/types';
import { navigateTo } from 'src/utils/navigationUtils';
import type { ConnectDragSource } from 'react-dnd';
import AddSliceCard from './AddSliceCard';
import AddSliceDragPreview from './dnd/AddSliceDragPreview';
import { DragDroppable } from './dnd/DragDroppable';

export type SliceAdderProps = {
  fetchSlices: (
    userId?: number,
    filter_value?: string,
    sortColumn?: string,
  ) => Promise<void>;
  updateSlices: (slices: {
    [id: number]: Slice;
  }) => (dispatch: Dispatch) => void;
  isLoading: boolean;
  slices: Record<number, Slice>;
  lastUpdated: number;
  errorMessage?: string;
  userId: number;
  selectedSliceIds?: number[];
  editMode?: boolean;
  dashboardId: number;
};

const KEYS_TO_FILTERS = ['slice_name', 'viz_type', 'datasource_name'];
const KEYS_TO_SORT = {
  slice_name: t('name'),
  viz_type: t('viz type'),
  datasource_name: t('dataset'),
  changed_on: t('recent'),
};

export const DEFAULT_SORT_KEY = 'changed_on';

const DEFAULT_CELL_HEIGHT = 128;

const Controls = styled.div`
  ${({ theme }) => `
    display: flex;
    flex-direction: row;
    padding:
      ${theme.sizeUnit * 4}px
      ${theme.sizeUnit * 3}px
      ${theme.sizeUnit * 4}px
      ${theme.sizeUnit * 3}px;
  `}
`;

const StyledSelect = styled(Select)<{ id?: string }>`
  margin-left: ${({ theme }) => theme.sizeUnit * 2}px;
  min-width: 150px;
`;

const NewChartButtonContainer = styled.div`
  ${({ theme }) => css`
    display: flex;
    justify-content: flex-end;
    padding-right: ${theme.sizeUnit * 2}px;
  `}
`;

const NewChartButton = styled(Button)`
  ${({ theme }) => css`
    height: auto;
    & > .anticon > span {
      margin: auto -${theme.sizeUnit}px auto 0;
    }
    & > [role='img']:first-of-type {
      padding-bottom: 1px;
      line-height: 0;
    }
  `}
`;

export const ChartList = styled.div`
  flex-grow: 1;
  min-height: 0;
`;

export function sortByComparator(attr: keyof Slice) {
  const desc = attr === 'changed_on' ? -1 : 1;

  return (a: Slice, b: Slice) => {
    const aValue = a[attr] ?? Number.MIN_SAFE_INTEGER;
    const bValue = b[attr] ?? Number.MIN_SAFE_INTEGER;

    if (aValue < bValue) {
      return -1 * desc;
    }
    if (aValue > bValue) {
      return 1 * desc;
    }
    return 0;
  };
}

function getFilteredSortedSlices(
  slices: SliceAdderProps['slices'],
  searchTerm: string,
  sortBy: keyof Slice,
  showOnlyMyCharts: boolean,
  userId: number,
) {
  return Object.values(slices)
    .filter(slice =>
      showOnlyMyCharts
        ? slice?.owners?.find(owner => owner.id === userId) ||
          slice?.created_by?.id === userId
        : true,
    )
    .filter(createFilter(searchTerm, KEYS_TO_FILTERS))
    .sort(sortByComparator(sortBy));
}

function SliceAdder({
  fetchSlices,
  updateSlices,
  isLoading,
  slices,
  errorMessage = '',
  userId,
  selectedSliceIds = [],
  editMode = false,
  dashboardId,
}: SliceAdderProps) {
  const theme = useTheme();
  const slicesRequestRef = useRef<AbortController | Promise<void>>();

  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<keyof Slice>(DEFAULT_SORT_KEY);
  const [selectedSliceIdsSet, setSelectedSliceIdsSet] = useState(
    () => new Set(selectedSliceIds),
  );
  const [showOnlyMyCharts, setShowOnlyMyCharts] = useState(() =>
    getItem(LocalStorageKeys.DashboardEditorShowOnlyMyCharts, true),
  );

  const filteredSlices = useMemo(
    () =>
      getFilteredSortedSlices(
        slices,
        searchTerm,
        sortBy,
        showOnlyMyCharts,
        userId,
      ),
    [slices, searchTerm, sortBy, showOnlyMyCharts, userId],
  );

  const userIdForFetch = useCallback(
    () => (showOnlyMyCharts ? userId : undefined),
    [showOnlyMyCharts, userId],
  );

  // componentDidMount
  useEffect(() => {
    slicesRequestRef.current = fetchSlices(userIdForFetch(), '', sortBy);
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update selectedSliceIdsSet when selectedSliceIds prop changes
  useEffect(() => {
    setSelectedSliceIdsSet(new Set(selectedSliceIds));
  }, [selectedSliceIds]);

  // componentWillUnmount
  useEffect(
    () => () => {
      // Clears the redux store keeping only selected items
      const selectedSlices = pickBy(slices, (value: Slice) =>
        selectedSliceIdsSet.has(value.slice_id),
      );

      updateSlices(selectedSlices);
      if (slicesRequestRef.current instanceof AbortController) {
        slicesRequestRef.current.abort();
      }
    },
    // Only run on unmount - capture current values
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const searchUpdated = useCallback((term: string) => {
    setSearchTerm(term);
  }, []);

  const handleChange = useMemo(
    () =>
      debounce((value: string) => {
        searchUpdated(value);
        slicesRequestRef.current = fetchSlices(userIdForFetch(), value, sortBy);
      }, 300),
    [fetchSlices, searchUpdated, sortBy, userIdForFetch],
  );

  const handleSelect = useCallback(
    (newSortBy: keyof Slice) => {
      setSortBy(newSortBy);
      slicesRequestRef.current = fetchSlices(
        userIdForFetch(),
        searchTerm,
        newSortBy,
      );
    },
    [fetchSlices, searchTerm, userIdForFetch],
  );

  const onShowOnlyMyCharts = useCallback(
    (checked: boolean) => {
      if (!checked) {
        slicesRequestRef.current = fetchSlices(undefined, searchTerm, sortBy);
      }
      setShowOnlyMyCharts(checked);
      setItem(LocalStorageKeys.DashboardEditorShowOnlyMyCharts, checked);
    },
    [fetchSlices, searchTerm, sortBy],
  );

  const rowRenderer = useCallback(
    ({ index, style }: { index: number; style: React.CSSProperties }) => {
      const cellData = filteredSlices[index];

      const isSelected = selectedSliceIdsSet.has(cellData.slice_id);
      const type = CHART_TYPE;
      const id = NEW_CHART_ID;

      const meta = {
        chartId: cellData.slice_id,
        sliceName: cellData.slice_name,
      };
      return (
        <DragDroppable
          key={cellData.slice_id}
          component={{ type, id, meta }}
          parentComponent={{
            id: NEW_COMPONENTS_SOURCE_ID,
            type: NEW_COMPONENT_SOURCE_TYPE,
          }}
          index={index}
          depth={0}
          disableDragDrop={isSelected}
          editMode={editMode}
          // we must use a custom drag preview within the List because
          // it does not seem to work within a fixed-position container
          useEmptyDragPreview
          // List library expect style props here
          // actual style should be applied to nested AddSliceCard component
          style={{}}
        >
          {({ dragSourceRef }: { dragSourceRef: ConnectDragSource }) => (
            <AddSliceCard
              innerRef={dragSourceRef}
              style={style}
              sliceName={cellData.slice_name}
              lastModified={cellData.changed_on_humanized}
              visType={cellData.viz_type}
              datasourceUrl={cellData.datasource_url}
              datasourceName={cellData.datasource_name}
              thumbnailUrl={cellData.thumbnail_url}
              isSelected={isSelected}
            />
          )}
        </DragDroppable>
      );
    },
    [filteredSlices, selectedSliceIdsSet, editMode],
  );

  return (
    <div
      css={css`
        height: 100%;
        display: flex;
        flex-direction: column;
        button > span > :first-of-type {
          margin-right: 0;
        }
      `}
    >
      <NewChartButtonContainer>
        <NewChartButton
          buttonStyle="link"
          buttonSize="xsmall"
          icon={
            <Icons.PlusOutlined iconSize="m" iconColor={theme.colorPrimary} />
          }
          onClick={() =>
            navigateTo(`/chart/add?dashboard_id=${dashboardId}`, {
              newWindow: true,
            })
          }
        >
          {t('Create new chart')}
        </NewChartButton>
      </NewChartButtonContainer>
      <Controls>
        <Input
          placeholder={
            showOnlyMyCharts ? t('Filter your charts') : t('Filter charts')
          }
          className="search-input"
          onChange={ev => handleChange(ev.target.value)}
          data-test="dashboard-charts-filter-search-input"
        />
        <StyledSelect
          id="slice-adder-sortby"
          value={sortBy}
          onChange={handleSelect}
          options={Object.entries(KEYS_TO_SORT).map(([key, label]) => ({
            label: t('Sort by %s', label),
            value: key,
          }))}
          placeholder={t('Sort by')}
        />
      </Controls>
      <div
        css={themeObj => css`
          display: flex;
          flex-direction: row;
          justify-content: flex-start;
          align-items: center;
          gap: ${themeObj.sizeUnit}px;
          padding: 0 ${themeObj.sizeUnit * 3}px ${themeObj.sizeUnit * 4}px
            ${themeObj.sizeUnit * 3}px;
        `}
      >
        <Checkbox
          onChange={e => onShowOnlyMyCharts(e.target.checked)}
          checked={showOnlyMyCharts}
        />
        {t('Show only my charts')}
        <InfoTooltip
          placement="top"
          tooltip={t(
            `You can choose to display all charts that you have access to or only the ones you own.
              Your filter selection will be saved and remain active until you choose to change it.`,
          )}
        />
      </div>
      {isLoading && <Loading />}
      {!isLoading && filteredSlices.length > 0 && (
        <ChartList>
          <AutoSizer>
            {({ height, width }: { height: number; width: number }) => (
              <List
                width={width}
                height={height}
                itemCount={filteredSlices.length}
                itemSize={DEFAULT_CELL_HEIGHT}
                itemKey={index => filteredSlices[index].slice_id}
              >
                {rowRenderer}
              </List>
            )}
          </AutoSizer>
        </ChartList>
      )}
      {errorMessage && (
        <div
          css={css`
            padding: 16px;
          `}
        >
          {errorMessage}
        </div>
      )}
      {/* Drag preview is just a single fixed-position element */}
      <AddSliceDragPreview slices={filteredSlices} />
    </div>
  );
}

export default SliceAdder;
