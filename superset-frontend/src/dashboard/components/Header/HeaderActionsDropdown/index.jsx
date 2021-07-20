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
import React from 'react';
import PropTypes from 'prop-types';

import { styled, SupersetClient, t } from '@superset-ui/core';

import { Menu, NoAnimationDropdown } from 'src/common/components';
import Icons from 'src/components/Icons';
import { URL_PARAMS } from 'src/constants';
import ShareMenuItems from 'src/dashboard/components/menu/ShareMenuItems';
import CssEditor from 'src/dashboard/components/CssEditor';
import RefreshIntervalModal from 'src/dashboard/components/RefreshIntervalModal';
import SaveModal from 'src/dashboard/components/SaveModal';
import injectCustomCss from 'src/dashboard/util/injectCustomCss';
import { SAVE_TYPE_NEWDASHBOARD } from 'src/dashboard/util/constants';
import FilterScopeModal from 'src/dashboard/components/filterscope/FilterScopeModal';
import downloadAsImage from 'src/utils/downloadAsImage';
import getDashboardUrl from 'src/dashboard/util/getDashboardUrl';
import { getActiveFilters } from 'src/dashboard/util/activeDashboardFilters';
import { getUrlParam } from 'src/utils/urlUtils';

const propTypes = {
  addSuccessToast: PropTypes.func.isRequired,
  addDangerToast: PropTypes.func.isRequired,
  dashboardInfo: PropTypes.object.isRequired,
  dashboardId: PropTypes.number.isRequired,
  dashboardTitle: PropTypes.string.isRequired,
  dataMask: PropTypes.object.isRequired,
  customCss: PropTypes.string.isRequired,
  colorNamespace: PropTypes.string,
  colorScheme: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  updateCss: PropTypes.func.isRequired,
  forceRefreshAllCharts: PropTypes.func.isRequired,
  refreshFrequency: PropTypes.number.isRequired,
  shouldPersistRefreshFrequency: PropTypes.bool.isRequired,
  setRefreshFrequency: PropTypes.func.isRequired,
  startPeriodicRender: PropTypes.func.isRequired,
  editMode: PropTypes.bool.isRequired,
  userCanEdit: PropTypes.bool.isRequired,
  userCanShare: PropTypes.bool.isRequired,
  userCanSave: PropTypes.bool.isRequired,
  isLoading: PropTypes.bool.isRequired,
  layout: PropTypes.object.isRequired,
  expandedSlices: PropTypes.object.isRequired,
  onSave: PropTypes.func.isRequired,
  showPropertiesModal: PropTypes.func.isRequired,
  refreshLimit: PropTypes.number,
  refreshWarning: PropTypes.string,
  lastModifiedTime: PropTypes.number.isRequired,
};

const defaultProps = {
  colorNamespace: undefined,
  colorScheme: undefined,
  refreshLimit: 0,
  refreshWarning: null,
};

const MENU_KEYS = {
  SAVE_MODAL: 'save-modal',
  SHARE_DASHBOARD: 'share-dashboard',
  REFRESH_DASHBOARD: 'refresh-dashboard',
  AUTOREFRESH_MODAL: 'autorefresh-modal',
  SET_FILTER_MAPPING: 'set-filter-mapping',
  EDIT_PROPERTIES: 'edit-properties',
  EDIT_CSS: 'edit-css',
  DOWNLOAD_AS_IMAGE: 'download-as-image',
  TOGGLE_FULLSCREEN: 'toggle-fullscreen',
};

const DropdownButton = styled.div`
  margin-left: ${({ theme }) => theme.gridUnit * 2.5}px;
  span {
    color: ${({ theme }) => theme.colors.grayscale.base};
  }
`;

const SCREENSHOT_NODE_SELECTOR = '.dashboard';

class HeaderActionsDropdown extends React.PureComponent {
  static discardChanges() {
    window.location.reload();
  }

  constructor(props) {
    super(props);
    this.state = {
      css: props.customCss,
      cssTemplates: [],
    };

    this.changeCss = this.changeCss.bind(this);
    this.changeRefreshInterval = this.changeRefreshInterval.bind(this);
    this.handleMenuClick = this.handleMenuClick.bind(this);
  }

  UNSAFE_componentWillMount() {
    injectCustomCss(this.state.css);

    SupersetClient.get({ endpoint: '/csstemplateasyncmodelview/api/read' })
      .then(({ json }) => {
        const cssTemplates = json.result.map(row => ({
          value: row.template_name,
          css: row.css,
          label: row.template_name,
        }));
        this.setState({ cssTemplates });
      })
      .catch(() => {
        this.props.addDangerToast(
          t('An error occurred while fetching available CSS templates'),
        );
      });
  }

  changeCss(css) {
    this.setState({ css }, () => {
      injectCustomCss(css);
    });
    this.props.onChange();
    this.props.updateCss(css);
  }

  changeRefreshInterval(refreshInterval, isPersistent) {
    this.props.setRefreshFrequency(refreshInterval, isPersistent);
    this.props.startPeriodicRender(refreshInterval * 1000);
  }

  handleMenuClick({ key, domEvent }) {
    switch (key) {
      case MENU_KEYS.REFRESH_DASHBOARD:
        this.props.forceRefreshAllCharts();
        break;
      case MENU_KEYS.EDIT_PROPERTIES:
        this.props.showPropertiesModal();
        break;
      case MENU_KEYS.DOWNLOAD_AS_IMAGE: {
        // menu closes with a delay, we need to hide it manually,
        // so that we don't capture it on the screenshot
        const menu = document.querySelector(
          '.ant-dropdown:not(.ant-dropdown-hidden)',
        );
        menu.style.visibility = 'hidden';
        downloadAsImage(
          SCREENSHOT_NODE_SELECTOR,
          this.props.dashboardTitle,
          {},
          true,
        )(domEvent).then(() => {
          menu.style.visibility = 'visible';
        });
        break;
      }
      case MENU_KEYS.TOGGLE_FULLSCREEN: {
        const url = getDashboardUrl({
          dataMask: this.props.dataMask,
          pathname: window.location.pathname,
          filters: getActiveFilters(),
          hash: window.location.hash,
          standalone: !getUrlParam(URL_PARAMS.standalone),
        });
        window.location.replace(url);
        break;
      }
      default:
        break;
    }
  }

  render() {
    const {
      dashboardTitle,
      dashboardId,
      dashboardInfo,
      dataMask,
      refreshFrequency,
      shouldPersistRefreshFrequency,
      editMode,
      customCss,
      colorNamespace,
      colorScheme,
      layout,
      expandedSlices,
      onSave,
      userCanEdit,
      userCanShare,
      userCanSave,
      isLoading,
      refreshLimit,
      refreshWarning,
      lastModifiedTime,
      addSuccessToast,
      addDangerToast,
    } = this.props;

    const emailTitle = t('Superset dashboard');
    const emailSubject = `${emailTitle} ${dashboardTitle}`;
    const emailBody = t('Check out this dashboard: ');

    const url = getDashboardUrl({
      dataMask,
      pathname: window.location.pathname,
      filters: getActiveFilters(),
      hash: window.location.hash,
    });

    const menu = (
      <Menu
        onClick={this.handleMenuClick}
        selectable={false}
        data-test="header-actions-menu"
      >
        {userCanSave && (
          <Menu.Item key={MENU_KEYS.SAVE_MODAL}>
            <SaveModal
              addSuccessToast={this.props.addSuccessToast}
              addDangerToast={this.props.addDangerToast}
              dashboardId={dashboardId}
              dashboardTitle={dashboardTitle}
              dashboardInfo={dashboardInfo}
              saveType={SAVE_TYPE_NEWDASHBOARD}
              layout={layout}
              expandedSlices={expandedSlices}
              refreshFrequency={refreshFrequency}
              shouldPersistRefreshFrequency={shouldPersistRefreshFrequency}
              lastModifiedTime={lastModifiedTime}
              customCss={customCss}
              colorNamespace={colorNamespace}
              colorScheme={colorScheme}
              onSave={onSave}
              triggerNode={
                <span data-test="save-as-menu-item">{t('Save as')}</span>
              }
              canOverwrite={userCanEdit}
            />
          </Menu.Item>
        )}
        {userCanShare && (
          <ShareMenuItems
            url={url}
            copyMenuItemTitle={t('Copy dashboard URL')}
            emailMenuItemTitle={t('Share dashboard by email')}
            emailSubject={emailSubject}
            emailBody={emailBody}
            addSuccessToast={addSuccessToast}
            addDangerToast={addDangerToast}
          />
        )}
        <Menu.Item
          key={MENU_KEYS.REFRESH_DASHBOARD}
          data-test="refresh-dashboard-menu-item"
          disabled={isLoading}
        >
          {t('Refresh dashboard')}
        </Menu.Item>
        <Menu.Divider />
        <Menu.Item key={MENU_KEYS.AUTOREFRESH_MODAL}>
          <RefreshIntervalModal
            refreshFrequency={refreshFrequency}
            refreshLimit={refreshLimit}
            refreshWarning={refreshWarning}
            onChange={this.changeRefreshInterval}
            editMode={editMode}
            triggerNode={<span>{t('Set auto-refresh interval')}</span>}
          />
        </Menu.Item>

        {editMode && (
          <Menu.Item key={MENU_KEYS.SET_FILTER_MAPPING}>
            <FilterScopeModal
              className="m-r-5"
              triggerNode={t('Set filter mapping')}
            />
          </Menu.Item>
        )}

        {editMode && (
          <Menu.Item key={MENU_KEYS.EDIT_PROPERTIES}>
            {t('Edit dashboard properties')}
          </Menu.Item>
        )}

        {editMode && (
          <Menu.Item key={MENU_KEYS.EDIT_CSS}>
            <CssEditor
              triggerNode={<span>{t('Edit CSS')}</span>}
              initialCss={this.state.css}
              templates={this.state.cssTemplates}
              onChange={this.changeCss}
            />
          </Menu.Item>
        )}

        {!editMode && (
          <Menu.Item key={MENU_KEYS.DOWNLOAD_AS_IMAGE}>
            {t('Download as image')}
          </Menu.Item>
        )}

        {!editMode && (
          <Menu.Item key={MENU_KEYS.TOGGLE_FULLSCREEN}>
            {getUrlParam(URL_PARAMS.standalone)
              ? t('Exit fullscreen')
              : t('Enter fullscreen')}
          </Menu.Item>
        )}
      </Menu>
    );
    return (
      <NoAnimationDropdown
        overlay={menu}
        trigger={['click']}
        getPopupContainer={triggerNode =>
          triggerNode.closest('.dashboard-header')
        }
      >
        <DropdownButton id="save-dash-split-button" role="button">
          <Icons.MoreHoriz />
        </DropdownButton>
      </NoAnimationDropdown>
    );
  }
}

HeaderActionsDropdown.propTypes = propTypes;
HeaderActionsDropdown.defaultProps = defaultProps;

export default HeaderActionsDropdown;
