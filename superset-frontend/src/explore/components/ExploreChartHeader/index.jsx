// DODO was here
import React, { useEffect, useState } from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import PropTypes from 'prop-types';
import { Tooltip } from 'src/components/Tooltip';
import {
  CategoricalColorNamespace,
  css,
  SupersetClient,
  t,
} from '@superset-ui/core';
import { toggleActive, deleteActiveReport } from 'src/reports/actions/reports';
import { chartPropShape } from 'src/dashboard/util/propShapes';
import AlteredSliceTag from 'src/components/AlteredSliceTag';
import Button from 'src/components/Button';
import Icons from 'src/components/Icons';
import PropertiesModal from 'src/explore/components/PropertiesModal';
import { sliceUpdated } from 'src/explore/actions/exploreActions';
import { PageHeaderWithActions } from 'src/components/PageHeaderWithActions';
import { useExploreAdditionalActionsMenu } from '../useExploreAdditionalActionsMenu';
import {
  TitlePanelAdditionalItemsWrapper,
  BaseTooltip,
  DashboardsWrapper,
  FundProjectIcon,
  ChartUsageContainer,
  StyledUl,
  StyledLi,
} from './styles';

const propTypes = {
  actions: PropTypes.object.isRequired,
  canOverwrite: PropTypes.bool.isRequired,
  canDownload: PropTypes.bool.isRequired,
  dashboardId: PropTypes.number,
  isStarred: PropTypes.bool.isRequired,
  slice: PropTypes.object,
  sliceName: PropTypes.string,
  table_name: PropTypes.string,
  formData: PropTypes.object,
  ownState: PropTypes.object,
  timeout: PropTypes.number,
  chart: chartPropShape,
  saveDisabled: PropTypes.bool,
};

const saveButtonStyles = theme => css`
  color: ${theme.colors.primary.dark2};
  & > span[role='img'] {
    margin-right: 0;
  }
`;

const textForms = [
  t('One_dashboard'),
  t('Two_to_4_dashboards'),
  t('Five_and_more_dashboards'),
];

const declOfNum = (n, textForms) => {
  const n2 = Math.abs(n) % 100;
  const n1 = n % 10;
  if (n2 > 10 && n2 < 20) {
    return textForms[2];
  }
  if (n1 > 1 && n1 < 5) {
    return textForms[1];
  }
  if (n1 === 1) {
    return textForms[0];
  }
  return textForms[2];
};
const parseDashboardsData = dashboardsData => ({
  text: `${t('Added_to')} ${dashboardsData.length} ${declOfNum(
    dashboardsData.length,
    textForms,
  )}`,
  tooltipText: (
    <StyledUl>
      {dashboardsData.map(dashboard => (
        <StyledLi>
          <a
            target="_blank"
            rel="noreferrer"
            href={`${window.location.origin}/superset/dashboard/${dashboard.id}`}
          >
            {dashboard.dashboard_title}
          </a>
        </StyledLi>
      ))}
    </StyledUl>
  ),
});

const ChartUsageWrapper = ({ dashboardsData }) => (
  <ChartUsageContainer>
    <BaseTooltip
      placement="right"
      id="tooltipTextDashboards"
      title={dashboardsData.tooltipText}
    >
      <DashboardsWrapper>
        <FundProjectIcon />
        <span className="metadata-text">{dashboardsData.text}</span>
      </DashboardsWrapper>
    </BaseTooltip>
  </ChartUsageContainer>
);

export const ExploreChartHeader = ({
  dashboardId,
  slice,
  actions,
  formData,
  ownState,
  chart,
  user,
  canOverwrite,
  canDownload,
  isStarred,
  sliceUpdated,
  sliceName,
  onSaveChart,
  saveDisabled,
}) => {
  const { latestQueryFormData, sliceFormData } = chart;
  const [isPropertiesModalOpen, setIsPropertiesModalOpen] = useState(false);
  const [dashboardsData, setDashboardsData] = useState(null);

  const fetchChartDashboardData = async () => {
    await SupersetClient.get({
      endpoint: `/api/v1/chart/${slice.slice_id}`,
    })
      .then(res => {
        const response = res?.json?.result;
        if (response && response.dashboards && response.dashboards.length) {
          const { dashboards } = response;
          const dashboard =
            dashboardId &&
            dashboards.length &&
            dashboards.find(d => d.id === dashboardId);

          if (dashboards && dashboards.length) setDashboardsData(dashboards);

          if (dashboard && dashboard.json_metadata) {
            // setting the chart to use the dashboard custom label colors if any
            const metadata = JSON.parse(dashboard.json_metadata);
            const sharedLabelColors = metadata.shared_label_colors || {};
            const customLabelColors = metadata.label_colors || {};
            const mergedLabelColors = {
              ...sharedLabelColors,
              ...customLabelColors,
            };

            const categoricalNamespace =
              CategoricalColorNamespace.getNamespace();

            Object.keys(mergedLabelColors).forEach(label => {
              categoricalNamespace.setColor(
                label,
                mergedLabelColors[label],
                metadata.color_scheme,
              );
            });
          }
        }
      })
      .catch(() => {});
  };

  const fetchChartDashboardsData = async () => {
    await SupersetClient.get({
      endpoint: `/api/v1/chart/${slice.slice_id}`,
    })
      .then(res => {
        const response = res?.json?.result;
        if (response && response.dashboards && response.dashboards.length) {
          const { dashboards } = response;
          if (dashboards && dashboards.length) setDashboardsData(dashboards);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    if (dashboardId) {
      fetchChartDashboardData();
    } else {
      fetchChartDashboardsData();
    }
  }, []);

  const openPropertiesModal = () => {
    setIsPropertiesModalOpen(true);
  };

  const closePropertiesModal = () => {
    setIsPropertiesModalOpen(false);
  };

  const [menu, isDropdownVisible, setIsDropdownVisible] =
    useExploreAdditionalActionsMenu(
      latestQueryFormData,
      canDownload,
      slice,
      actions.redirectSQLLab,
      openPropertiesModal,
      ownState,
    );

  const oldSliceName = slice?.slice_name;
  return (
    <>
      <PageHeaderWithActions
        editableTitleProps={{
          title: sliceName,
          canEdit:
            !slice ||
            canOverwrite ||
            (slice?.owners || []).includes(user?.userId),
          onSave: actions.updateChartTitle,
          placeholder: t('Add the name of the chart'),
          label: t('Chart title'),
        }}
        showTitlePanelItems={!!slice}
        certificatiedBadgeProps={{
          certifiedBy: slice?.certified_by,
          details: slice?.certification_details,
        }}
        showFaveStar={!!user?.userId}
        faveStarProps={{
          itemId: slice?.slice_id,
          fetchFaveStar: actions.fetchFaveStar,
          saveFaveStar: actions.saveFaveStar,
          isStarred,
          showTooltip: true,
        }}
        titlePanelAdditionalItems={
          <TitlePanelAdditionalItemsWrapper>
            {sliceFormData ? (
              <AlteredSliceTag
                className="altered"
                origFormData={{
                  ...sliceFormData,
                  chartTitle: oldSliceName,
                }}
                currentFormData={{ ...formData, chartTitle: sliceName }}
              />
            ) : null}
            {dashboardsData && dashboardsData.length && (
              <ChartUsageWrapper
                dashboardsData={parseDashboardsData(dashboardsData)}
              />
            )}
          </TitlePanelAdditionalItemsWrapper>
        }
        rightPanelAdditionalItems={
          <Tooltip
            title={
              saveDisabled
                ? t('Add required control values to save chart')
                : null
            }
          >
            {/* needed to wrap button in a div - antd tooltip doesn't work with disabled button */}
            <div>
              <Button
                buttonStyle="secondary"
                onClick={onSaveChart}
                disabled={saveDisabled}
                data-test="query-save-button"
                css={saveButtonStyles}
              >
                <Icons.SaveOutlined iconSize="l" />
                {t('Save')}
              </Button>
            </div>
          </Tooltip>
        }
        additionalActionsMenu={menu}
        menuDropdownProps={{
          visible: isDropdownVisible,
          onVisibleChange: setIsDropdownVisible,
        }}
      />
      {isPropertiesModalOpen && (
        <PropertiesModal
          show={isPropertiesModalOpen}
          onHide={closePropertiesModal}
          onSave={sliceUpdated}
          slice={slice}
        />
      )}
    </>
  );
};

ExploreChartHeader.propTypes = propTypes;

function mapDispatchToProps(dispatch) {
  return bindActionCreators(
    { sliceUpdated, toggleActive, deleteActiveReport },
    dispatch,
  );
}

export default connect(null, mapDispatchToProps)(ExploreChartHeader);
