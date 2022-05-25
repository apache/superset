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
import React, { FC, useEffect, useMemo, useRef, useState } from 'react';
import { styled, t } from '@superset-ui/core';
import { useUiConfig } from 'src/components/UiConfigContext';
import { Tooltip } from 'src/components/Tooltip';
import { useDispatch, useSelector } from 'react-redux';
import EditableTitle from 'src/components/EditableTitle';
import SliceHeaderControls, {
  SliceHeaderControlsProps,
} from 'src/dashboard/components/SliceHeaderControls';
import FiltersBadge from 'src/dashboard/components/FiltersBadge';
import Icons from 'src/components/Icons';
import { RootState } from 'src/dashboard/types';
import FilterIndicator from 'src/dashboard/components/FiltersBadge/FilterIndicator';
import { clearDataMask } from 'src/dataMask/actions';

type SliceHeaderProps = SliceHeaderControlsProps & {
  innerRef?: string;
  updateSliceName?: (arg0: string) => void;
  editMode?: boolean;
  annotationQuery?: object;
  annotationError?: object;
  sliceName?: string;
  filters: object;
  handleToggleFullSize: () => void;
  formData: object;
  width: number;
  height: number;
};

const annotationsLoading = t('Annotation layers are still loading.');
const annotationsError = t('One ore more annotation layers failed loading.');
const CrossFilterIcon = styled(Icons.CursorTarget)`
  cursor: pointer;
  color: ${({ theme }) => theme.colors.primary.base};
  height: 22px;
  width: 22px;
`;

const SliceHeader: FC<SliceHeaderProps> = ({
  innerRef = null,
  forceRefresh = () => ({}),
  updateSliceName = () => ({}),
  toggleExpandSlice = () => ({}),
  logExploreChart = () => ({}),
  onExploreChart,
  exportCSV = () => ({}),
  editMode = false,
  annotationQuery = {},
  annotationError = {},
  cachedDttm = null,
  updatedDttm = null,
  isCached = [],
  isExpanded = false,
  sliceName = '',
  supersetCanExplore = false,
  supersetCanShare = false,
  supersetCanCSV = false,
  sliceCanEdit = false,
  exportFullCSV,
  slice,
  componentId,
  dashboardId,
  addSuccessToast,
  addDangerToast,
  handleToggleFullSize,
  isFullSize,
  chartStatus,
  formData,
  width,
  height,
}) => {
  const dispatch = useDispatch();
  const uiConfig = useUiConfig();
  const [headerTooltip, setHeaderTooltip] = useState<string | null>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  // TODO: change to indicator field after it will be implemented
  const crossFilterValue = useSelector<RootState, any>(
    state => state.dataMask[slice?.slice_id]?.filterState?.value,
  );

  const indicator = useMemo(
    () => ({
      value: crossFilterValue,
      name: t('Emitted values'),
    }),
    [crossFilterValue],
  );

  const handleClickTitle =
    !editMode && supersetCanExplore ? onExploreChart : undefined;

  useEffect(() => {
    const headerElement = headerRef.current;
    if (handleClickTitle) {
      setHeaderTooltip(
        sliceName
          ? t('Click to edit %s in a new tab', sliceName)
          : t('Click to edit chart in a new tab'),
      );
    } else if (
      headerElement &&
      (headerElement.scrollWidth > headerElement.offsetWidth ||
        headerElement.scrollHeight > headerElement.offsetHeight)
    ) {
      setHeaderTooltip(sliceName ?? null);
    } else {
      setHeaderTooltip(null);
    }
  }, [sliceName, width, height, handleClickTitle]);

  return (
    <div className="chart-header" data-test="slice-header" ref={innerRef}>
      <div className="header-title" ref={headerRef}>
        <Tooltip title={headerTooltip}>
          <EditableTitle
            title={
              sliceName ||
              (editMode
                ? '---' // this makes an empty title clickable
                : '')
            }
            canEdit={editMode}
            emptyText=""
            onSaveTitle={updateSliceName}
            showTooltip={false}
            onClickTitle={handleClickTitle}
          />
        </Tooltip>
        {!!Object.values(annotationQuery).length && (
          <Tooltip
            id="annotations-loading-tooltip"
            placement="top"
            title={annotationsLoading}
          >
            <i
              role="img"
              aria-label={annotationsLoading}
              className="fa fa-refresh warning"
            />
          </Tooltip>
        )}
        {!!Object.values(annotationError).length && (
          <Tooltip
            id="annoation-errors-tooltip"
            placement="top"
            title={annotationsError}
          >
            <i
              role="img"
              aria-label={annotationsError}
              className="fa fa-exclamation-circle danger"
            />
          </Tooltip>
        )}
      </div>
      <div className="header-controls">
        {!editMode && (
          <>
            {crossFilterValue && (
              <Tooltip
                placement="top"
                title={
                  <FilterIndicator
                    indicator={indicator}
                    text={t('Click to clear emitted filters')}
                  />
                }
              >
                <CrossFilterIcon
                  onClick={() => dispatch(clearDataMask(slice?.slice_id))}
                />
              </Tooltip>
            )}
            {!uiConfig.hideChartControls && (
              <FiltersBadge chartId={slice.slice_id} />
            )}
            {!uiConfig.hideChartControls && (
              <SliceHeaderControls
                slice={slice}
                isCached={isCached}
                isExpanded={isExpanded}
                cachedDttm={cachedDttm}
                updatedDttm={updatedDttm}
                toggleExpandSlice={toggleExpandSlice}
                forceRefresh={forceRefresh}
                logExploreChart={logExploreChart}
                onExploreChart={onExploreChart}
                exportCSV={exportCSV}
                exportFullCSV={exportFullCSV}
                supersetCanExplore={supersetCanExplore}
                supersetCanShare={supersetCanShare}
                supersetCanCSV={supersetCanCSV}
                sliceCanEdit={sliceCanEdit}
                componentId={componentId}
                dashboardId={dashboardId}
                addSuccessToast={addSuccessToast}
                addDangerToast={addDangerToast}
                handleToggleFullSize={handleToggleFullSize}
                isFullSize={isFullSize}
                isDescriptionExpanded={isExpanded}
                chartStatus={chartStatus}
                formData={formData}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default SliceHeader;
