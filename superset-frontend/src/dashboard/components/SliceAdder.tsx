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
import { t } from '@apache-superset/core/translation';
import { styled, css, useTheme } from '@apache-superset/core/theme';
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
import { debounce } from 'lodash-es';
import { Slice } from 'src/dashboard/types';
import type { SlicesListParams } from 'src/dashboard/queries';
import { navigateTo } from 'src/utils/navigationUtils';
import type { ConnectDragSource } from 'react-dnd';
import AddSliceCard from './AddSliceCard';
import AddSliceDragPreview from './dnd/AddSliceDragPreview';
import { DragDroppable } from './dnd/DragDroppable';
import { datasetLabelLower } from 'src/features/semanticLayers/label';

export type SliceAdderProps = {
  setQueryParams: (params: SlicesListParams) => void;
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
  datasource_name: datasetLabelLower(),
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
    padding: ${theme.sizeUnit * 3}px ${theme.sizeUnit * 2}px 0;
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
  setQueryParams,
  isLoading,
  slices,
  errorMessage = '',
  userId,
  selectedSliceIds = [],
  editMode = false,
  dashboardId,
}: SliceAdderProps) {
  const theme = useTheme();

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

  // Refs so the debounced search reads the latest sortBy/userIdForFetch at
  // fire time without recreating the debounce (which would drop a pending,
  // armed-but-not-yet-fired search when sortBy/showOnlyMyCharts change).
  const sortByRef = useRef(sortBy);
  const userIdForFetchRef = useRef(userIdForFetch);
  useEffect(() => {
    sortByRef.current = sortBy;
  }, [sortBy]);
  useEffect(() => {
    userIdForFetchRef.current = userIdForFetch;
  }, [userIdForFetch]);

  // Update selectedSliceIdsSet when selectedSliceIds prop changes
  useEffect(() => {
    setSelectedSliceIdsSet(new Set(selectedSliceIds));
  }, [selectedSliceIds]);

  const searchUpdated = useCallback((term: string) => {
    setSearchTerm(term);
  }, []);

  // Create the debounce once (stable identity) so a pending search isn't
  // dropped when sortBy/userIdForFetch change mid-typing. The debounced
  // function reads the latest values from refs at fire time.
  const handleChange = useMemo(
    () =>
      debounce((value: string) => {
        searchUpdated(value);
        setQueryParams({
          userId: userIdForFetchRef.current(),
          filterValue: value,
          sortColumn: sortByRef.current,
        });
      }, 300),
    [searchUpdated, setQueryParams],
  );

  useEffect(
    () => () => {
      handleChange.cancel();
    },
    [handleChange],
  );

  const handleSelect = useCallback(
    (newSortBy: keyof Slice) => {
      setSortBy(newSortBy);
      setQueryParams({
        userId: userIdForFetch(),
        filterValue: searchTerm,
        sortColumn: newSortBy,
      });
    },
    [setQueryParams, searchTerm, userIdForFetch],
  );

  const onShowOnlyMyCharts = useCallback(
    (checked: boolean) => {
      if (!checked) {
        setQueryParams({
          userId: undefined,
          filterValue: searchTerm,
          sortColumn: sortBy,
        });
      }
      setShowOnlyMyCharts(checked);
      setItem(LocalStorageKeys.DashboardEditorShowOnlyMyCharts, checked);
    },
    [setQueryParams, searchTerm, sortBy],
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
