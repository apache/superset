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
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import PropTypes from 'prop-types';
import { t } from '@superset-ui/core';
import { Dropdown, Menu } from 'src/common/components';
import downloadAsImage from 'src/utils/downloadAsImage';
import ModalTrigger from 'src/components/ModalTrigger';
import { sliceUpdated } from 'src/explore/actions/exploreActions';
import ViewQueryModal from '../controls/ViewQueryModal';

const propTypes = {
  onOpenPropertiesModal: PropTypes.func,
  onOpenInEditor: PropTypes.func,
  chartStatus: PropTypes.string,
  latestQueryFormData: PropTypes.object.isRequired,
  slice: PropTypes.object,
};

const MENU_KEYS = {
  EDIT_PROPERTIES: 'edit_properties',
  RUN_IN_SQL_LAB: 'run_in_sql_lab',
  DOWNLOAD_AS_IMAGE: 'download_as_image',
  VIEW_QUERY: 'view_query',
};

const ExploreAdditionalActionsMenu = props => {
  const { datasource } = props.latestQueryFormData;
  const sqlSupported = datasource && datasource.split('__')[1] === 'table';
  const handleMenuClick = ({ key, domEvent }) => {
    const { slice, onOpenInEditor, latestQueryFormData } = props;
    switch (key) {
      case MENU_KEYS.EDIT_PROPERTIES:
        props.onOpenPropertiesModal();
        break;
      case MENU_KEYS.RUN_IN_SQL_LAB:
        onOpenInEditor(latestQueryFormData);
        break;
      case MENU_KEYS.DOWNLOAD_AS_IMAGE:
        downloadAsImage(
          '.panel-body > .chart-container',
          // eslint-disable-next-line camelcase
          slice?.slice_name ?? t('New chart'),
          {},
          true,
        )(domEvent);
        break;
      default:
        break;
    }
  };

  const { slice } = props;
  return (
    <Dropdown
      trigger="click"
      data-test="query-dropdown"
      overlay={
        <Menu onClick={handleMenuClick} selectable={false}>
          {slice && (
            <Menu.Item key={MENU_KEYS.EDIT_PROPERTIES}>
              {t('Edit properties')}
            </Menu.Item>
          )}
          <Menu.Item key={MENU_KEYS.VIEW_QUERY}>
            <ModalTrigger
              triggerNode={
                <span data-test="view-query-menu-item">{t('View query')}</span>
              }
              modalTitle={t('View query')}
              modalBody={
                <ViewQueryModal
                  latestQueryFormData={props.latestQueryFormData}
                />
              }
              draggable
              resizable
              responsive
            />
          </Menu.Item>
          {sqlSupported && (
            <Menu.Item key={MENU_KEYS.RUN_IN_SQL_LAB}>
              {t('Run in SQL Lab')}
            </Menu.Item>
          )}
          <Menu.Item key={MENU_KEYS.DOWNLOAD_AS_IMAGE}>
            {t('Download as image')}
          </Menu.Item>
        </Menu>
      }
    >
      <div
        role="button"
        id="query"
        tabIndex={0}
        className="btn btn-default btn-sm"
      >
        <i role="img" className="fa fa-bars" />
      </div>
    </Dropdown>
  );
};

ExploreAdditionalActionsMenu.propTypes = propTypes;

function mapDispatchToProps(dispatch) {
  return bindActionCreators({ sliceUpdated }, dispatch);
}

export default connect(null, mapDispatchToProps)(ExploreAdditionalActionsMenu);
