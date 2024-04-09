// DODO was here
import React, {
  FC,
  ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { css, styled, t } from '@superset-ui/core';
import { useUiConfig } from 'src/components/UiConfigContext';
import { Tooltip } from 'src/components/Tooltip';
import { useSelector } from 'react-redux';
import EditableTitle from 'src/components/EditableTitle';
import SliceHeaderControls, {
  SliceHeaderControlsProps,
} from 'src/dashboard/components/SliceHeaderControls';
import FiltersBadge from 'src/dashboard/components/FiltersBadge';
import Icons from 'src/components/Icons';
import { RootState } from 'src/dashboard/types';
import { getSliceHeaderTooltip } from 'src/dashboard/util/getSliceHeaderTooltip';
import { DashboardPageIdContext } from 'src/dashboard/containers/DashboardPage';
import {
  LanguageIndicatorWrapper,
  LanguageIndicator,
} from 'src/DodoExtensions/Common/index';

type SliceHeaderProps = SliceHeaderControlsProps & {
  innerRef?: string;
  updateSliceName?: (arg0: string) => void;
  // DODO added
  updateSliceNameRU?: (arg0: string) => void;
  editMode?: boolean;
  annotationQuery?: object;
  annotationError?: object;
  sliceName?: string;
  // DODO added
  sliceNameRU?: string;
  filters: object;
  handleToggleFullSize: () => void;
  formData: object;
  width: number;
  height: number;
  // DODO added
  userLanguage: string;
};

const annotationsLoading = t('Annotation layers are still loading.');
const annotationsError = t('One ore more annotation layers failed loading.');
const CrossFilterIcon = styled(Icons.ApartmentOutlined)`
  ${({ theme }) => `
    cursor: default;
    color: ${theme.colors.primary.base};
    line-height: 1.8;
  `}
`;

const ChartHeaderStyles = styled.div`
  ${({ theme }) => css`
    font-size: ${theme.typography.sizes.l}px;
    font-weight: ${theme.typography.weights.bold};
    margin-bottom: ${theme.gridUnit}px;
    display: flex;
    max-width: 100%;
    align-items: flex-start;
    min-height: 0;

    & > .header-title {
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 100%;
      flex-grow: 1;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;

      & > span.ant-tooltip-open {
        display: inline;
      }
    }

    & > .header-controls {
      display: flex;
      align-items: center;
      height: 24px;

      & > * {
        margin-left: ${theme.gridUnit * 2}px;
      }
    }

    .dropdown.btn-group {
      pointer-events: none;
      vertical-align: top;
      & > * {
        pointer-events: auto;
      }
    }

    .dropdown-toggle.btn.btn-default {
      background: none;
      border: none;
      box-shadow: none;
    }

    .dropdown-menu.dropdown-menu-right {
      top: ${theme.gridUnit * 5}px;
    }

    .divider {
      margin: ${theme.gridUnit}px 0;
    }

    .refresh-tooltip {
      display: block;
      height: ${theme.gridUnit * 4}px;
      margin: ${theme.gridUnit}px 0;
      color: ${theme.colors.text.label};
    }
  `}
`;

const SliceHeader: FC<SliceHeaderProps> = ({
  innerRef = null,
  forceRefresh = () => ({}),
  updateSliceName = () => ({}),
  // DODO added
  updateSliceNameRU = () => ({}),
  toggleExpandSlice = () => ({}),
  logExploreChart = () => ({}),
  logEvent,
  exportCSV = () => ({}),
  exportXLSX = () => ({}),
  editMode = false,
  annotationQuery = {},
  annotationError = {},
  cachedDttm = null,
  updatedDttm = null,
  isCached = [],
  isExpanded = false,
  // DODO added
  sliceName = '---',
  sliceNameRU = '---',
  supersetCanExplore = false,
  supersetCanShare = false,
  supersetCanCSV = false,
  exportFullCSV,
  exportFullXLSX,
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
  // DODO added
  userLanguage,
}) => {
  const uiConfig = useUiConfig();
  const dashboardPageId = useContext(DashboardPageIdContext);
  const [headerTooltip, setHeaderTooltip] = useState<ReactNode | null>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  // TODO: change to indicator field after it will be implemented
  const crossFilterValue = useSelector<RootState, any>(
    state => state.dataMask[slice?.slice_id]?.filterState?.value,
  );
  const isCrossFiltersEnabled = useSelector<RootState, boolean>(
    ({ dashboardInfo }) => dashboardInfo.crossFiltersEnabled,
  );

  const canExplore = !editMode && supersetCanExplore;

  useEffect(() => {
    const headerElement = headerRef.current;
    if (canExplore) {
      setHeaderTooltip(getSliceHeaderTooltip(sliceName));
    } else if (
      headerElement &&
      (headerElement.scrollWidth > headerElement.offsetWidth ||
        headerElement.scrollHeight > headerElement.offsetHeight)
    ) {
      setHeaderTooltip(sliceName ?? null);
    } else {
      setHeaderTooltip(null);
    }
  }, [sliceName, width, height, canExplore]);

  const exploreUrl = `/explore/?dashboard_page_id=${dashboardPageId}&slice_id=${slice.slice_id}`;

  return (
    <ChartHeaderStyles data-test="slice-header" ref={innerRef}>
      <div className="header-title" ref={headerRef}>
        {editMode && (
          <>
            {/* DODO added */}
            <LanguageIndicatorWrapper>
              <LanguageIndicator language="gb" canEdit />
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
                />
              </Tooltip>
            </LanguageIndicatorWrapper>
            <LanguageIndicatorWrapper>
              <LanguageIndicator language="ru" canEdit />
              <Tooltip title={headerTooltip}>
                <EditableTitle
                  title={
                    sliceNameRU ||
                    (editMode
                      ? '---' // this makes an empty title clickable
                      : '')
                  }
                  canEdit={editMode}
                  emptyText=""
                  onSaveTitle={updateSliceNameRU}
                  showTooltip={false}
                />
              </Tooltip>
            </LanguageIndicatorWrapper>
          </>
        )}

        {/* DODO added */}
        {!editMode && userLanguage !== 'ru' && (
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
              url={canExplore ? exploreUrl : undefined}
            />
          </Tooltip>
        )}

        {/* DODO added */}
        {!editMode && userLanguage === 'ru' && (
          <Tooltip title={headerTooltip}>
            <EditableTitle
              title={
                sliceNameRU ||
                sliceName ||
                (editMode
                  ? 'RU ---' // this makes an empty title clickable
                  : '')
              }
              canEdit={editMode}
              emptyText=""
              onSaveTitle={updateSliceNameRU}
              showTooltip={false}
              url={canExplore ? exploreUrl : undefined}
            />
          </Tooltip>
        )}

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
            id="annotation-errors-tooltip"
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
                title={t(
                  'This chart applies cross-filters to charts whose datasets contain columns with the same name.',
                )}
              >
                <CrossFilterIcon iconSize="m" />
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
                logEvent={logEvent}
                exportCSV={exportCSV}
                exportFullCSV={exportFullCSV}
                exportXLSX={exportXLSX}
                exportFullXLSX={exportFullXLSX}
                supersetCanExplore={supersetCanExplore}
                supersetCanShare={supersetCanShare}
                supersetCanCSV={supersetCanCSV}
                componentId={componentId}
                dashboardId={dashboardId}
                addSuccessToast={addSuccessToast}
                addDangerToast={addDangerToast}
                handleToggleFullSize={handleToggleFullSize}
                isFullSize={isFullSize}
                isDescriptionExpanded={isExpanded}
                chartStatus={chartStatus}
                formData={formData}
                exploreUrl={exploreUrl}
                crossFiltersEnabled={isCrossFiltersEnabled}
              />
            )}
          </>
        )}
      </div>
    </ChartHeaderStyles>
  );
};

export default SliceHeader;
