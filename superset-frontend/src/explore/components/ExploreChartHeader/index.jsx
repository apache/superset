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
import { useHistory } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import PropTypes from 'prop-types';
import { Tooltip } from 'src/components/Tooltip';
import {
  CategoricalColorNamespace,
  css,
  logging,
  SupersetClient,
  t,
  tn,
} from '@superset-ui/core';
import { chartPropShape } from 'src/dashboard/util/propShapes';
import AlteredSliceTag from 'src/components/AlteredSliceTag';
import Button from 'src/components/Button';
import Icons from 'src/components/Icons';
import PropertiesModal from 'src/explore/components/PropertiesModal';
import { sliceUpdated } from 'src/explore/actions/exploreActions';
import { PageHeaderWithActions } from 'src/components/PageHeaderWithActions';
import MetadataBar, { MetadataType } from 'src/components/MetadataBar';
import { setSaveChartModalVisibility } from 'src/explore/actions/saveModalActions';
import { useExploreAdditionalActionsMenu } from '../useExploreAdditionalActionsMenu';

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

const additionalItemsStyles = theme => css`
  display: flex;
  align-items: center;
  margin-left: ${theme.gridUnit}px;
  & > span {
    margin-right: ${theme.gridUnit * 3}px;
  }
`;

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
  sliceName,
  saveDisabled,
  metadata,
}) => {
  const dispatch = useDispatch();
  const { latestQueryFormData, sliceFormData } = chart;
  const [isPropertiesModalOpen, setIsPropertiesModalOpen] = useState(false);

  const updateCategoricalNamespace = async () => {
    const { dashboards } = metadata || {};
    const dashboard =
      dashboardId && dashboards && dashboards.find(d => d.id === dashboardId);

    if (dashboard) {
      try {
        // Dashboards from metadata don't contain the json_metadata field
        // to avoid unnecessary payload. Here we query for the dashboard json_metadata.
        const response = await SupersetClient.get({
          endpoint: `/api/v1/dashboard/${dashboard.id}`,
        });
        const result = response?.json?.result;

        // setting the chart to use the dashboard custom label colors if any
        const metadata = JSON.parse(result.json_metadata);
        const sharedLabelColors = metadata.shared_label_colors || {};
        const customLabelColors = metadata.label_colors || {};
        const mergedLabelColors = {
          ...sharedLabelColors,
          ...customLabelColors,
        };

        const categoricalNamespace = CategoricalColorNamespace.getNamespace();

        Object.keys(mergedLabelColors).forEach(label => {
          categoricalNamespace.setColor(
            label,
            mergedLabelColors[label],
            metadata.color_scheme,
          );
        });
      } catch (error) {
        logging.info(t('Unable to retrieve dashboard colors'));
      }
    }
  };

  useEffect(() => {
    if (dashboardId) updateCategoricalNamespace();
  }, []);

  const openPropertiesModal = () => {
    setIsPropertiesModalOpen(true);
  };

  const closePropertiesModal = () => {
    setIsPropertiesModalOpen(false);
  };

  const showModal = useCallback(() => {
    dispatch(setSaveChartModalVisibility(true));
  }, [dispatch]);

  const updateSlice = useCallback(
    slice => {
      dispatch(sliceUpdated(slice));
    },
    [dispatch],
  );

  const history = useHistory();
  const { redirectSQLLab } = actions;

  const redirectToSQLLab = useCallback(
    (formData, openNewWindow = false) => {
      redirectSQLLab(formData, !openNewWindow && history);
    },
    [redirectSQLLab, history],
  );

  const [menu, isDropdownVisible, setIsDropdownVisible] =
    useExploreAdditionalActionsMenu(
      latestQueryFormData,
      canDownload,
      slice,
      redirectToSQLLab,
      openPropertiesModal,
      ownState,
      metadata?.dashboards,
    );

  const metadataBar = useMemo(() => {
    if (!metadata) {
      return null;
    }
    const items = [];
    items.push({
      type: MetadataType.DASHBOARDS,
      title:
        metadata.dashboards.length > 0
          ? tn(
              'Added to 1 dashboard',
              'Added to %s dashboards',
              metadata.dashboards.length,
              metadata.dashboards.length,
            )
          : t('Not added to any dashboard'),
      description:
        metadata.dashboards.length > 0
          ? t(
              'You can preview the list of dashboards in the chart settings dropdown.',
            )
          : undefined,
    });
    items.push({
      type: MetadataType.LAST_MODIFIED,
      value: metadata.changed_on_humanized,
      modifiedBy: metadata.changed_by || t('Not available'),
    });
    items.push({
      type: MetadataType.OWNER,
      createdBy: metadata.created_by || t('Not available'),
      owners: metadata.owners.length > 0 ? metadata.owners : t('None'),
      createdOn: metadata.created_on_humanized,
    });
    if (slice?.description) {
      items.push({
        type: MetadataType.DESCRIPTION,
        value: slice?.description,
      });
    }
    return <MetadataBar items={items} tooltipPlacement="bottom" />;
  }, [metadata, slice?.description]);

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
          <div css={additionalItemsStyles}>
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
            {metadataBar}
          </div>
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
                onClick={showModal}
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
          onSave={updateSlice}
          slice={slice}
        />
      )}
    </>
  );
};

ExploreChartHeader.propTypes = propTypes;

export default ExploreChartHeader;
