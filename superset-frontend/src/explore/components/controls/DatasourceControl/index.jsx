/* eslint-disable camelcase */
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
import { t, styled, supersetTheme } from '@superset-ui/core';

import { Dropdown, Menu } from 'src/common/components';
import { Tooltip } from 'src/components/Tooltip';
import Icons from 'src/components/Icons';
import ChangeDatasourceModal from 'src/datasource/ChangeDatasourceModal';
import DatasourceModal from 'src/datasource/DatasourceModal';
import { postForm } from 'src/explore/exploreUtils';
import Button from 'src/components/Button';
import ErrorAlert from 'src/components/ErrorMessage/ErrorAlert';
import WarningIconWithTooltip from 'src/components/WarningIconWithTooltip';

const propTypes = {
  actions: PropTypes.object.isRequired,
  onChange: PropTypes.func,
  value: PropTypes.string,
  datasource: PropTypes.object.isRequired,
  form_data: PropTypes.object.isRequired,
  isEditable: PropTypes.bool,
  onDatasourceSave: PropTypes.func,
};

const defaultProps = {
  onChange: () => {},
  onDatasourceSave: null,
  value: null,
  isEditable: true,
};

const Styles = styled.div`
  .data-container {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
    padding: ${({ theme }) => 2 * theme.gridUnit}px;
  }
  .error-alert {
    margin: ${({ theme }) => 2 * theme.gridUnit}px;
  }
  .ant-dropdown-trigger {
    margin-left: ${({ theme }) => 2 * theme.gridUnit}px;
    box-shadow: none;
    &:active {
      box-shadow: none;
    }
  }
  .btn-group .open .dropdown-toggle {
    box-shadow: none;
    &.button-default {
      background: none;
    }
  }
  i.angle {
    color: ${({ theme }) => theme.colors.primary.base};
  }
  svg.datasource-modal-trigger {
    color: ${({ theme }) => theme.colors.primary.base};
    cursor: pointer;
  }
  .title-select {
    flex: 1 1 100%;
    display: inline-block;
    background-color: ${({ theme }) => theme.colors.grayscale.light3};
    padding: ${({ theme }) => theme.gridUnit * 2}px;
    border-radius: ${({ theme }) => theme.borderRadius}px;
    text-align: center;
    text-overflow: ellipsis;
    white-space: nowrap;
    overflow: hidden;
  }
  .dataset-svg {
    margin-right: ${({ theme }) => 2 * theme.gridUnit}px;
    flex: none;
  }
  span[aria-label='dataset-physical'] {
    color: ${({ theme }) => theme.colors.grayscale.base};
  }
  span[aria-label='more-vert'] {
    color: ${({ theme }) => theme.colors.primary.base};
  }
`;

const CHANGE_DATASET = 'change_dataset';
const VIEW_IN_SQL_LAB = 'view_in_sql_lab';
const EDIT_DATASET = 'edit_dataset';

class DatasourceControl extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      showEditDatasourceModal: false,
      showChangeDatasourceModal: false,
    };
    this.onDatasourceSave = this.onDatasourceSave.bind(this);
    this.toggleChangeDatasourceModal = this.toggleChangeDatasourceModal.bind(
      this,
    );
    this.toggleEditDatasourceModal = this.toggleEditDatasourceModal.bind(this);
    this.toggleShowDatasource = this.toggleShowDatasource.bind(this);
    this.handleMenuItemClick = this.handleMenuItemClick.bind(this);
  }

  onDatasourceSave(datasource) {
    this.props.actions.setDatasource(datasource);
    const timeCol = this.props.form_data?.granularity_sqla;
    const { columns } = this.props.datasource;
    const firstDttmCol = columns.find(column => column.is_dttm);
    if (
      datasource.type === 'table' &&
      !columns.find(({ column_name }) => column_name === timeCol)?.is_dttm
    ) {
      // set `granularity_sqla` to first datatime column name or null
      this.props.actions.setControlValue(
        'granularity_sqla',
        firstDttmCol ? firstDttmCol.column_name : null,
      );
    }
    if (this.props.onDatasourceSave) {
      this.props.onDatasourceSave(datasource);
    }
  }

  toggleShowDatasource() {
    this.setState(({ showDatasource }) => ({
      showDatasource: !showDatasource,
    }));
  }

  toggleChangeDatasourceModal() {
    this.setState(({ showChangeDatasourceModal }) => ({
      showChangeDatasourceModal: !showChangeDatasourceModal,
    }));
  }

  toggleEditDatasourceModal() {
    this.setState(({ showEditDatasourceModal }) => ({
      showEditDatasourceModal: !showEditDatasourceModal,
    }));
  }

  handleMenuItemClick({ key }) {
    if (key === CHANGE_DATASET) {
      this.toggleChangeDatasourceModal();
    }
    if (key === EDIT_DATASET) {
      this.toggleEditDatasourceModal();
    }
    if (key === VIEW_IN_SQL_LAB) {
      const { datasource } = this.props;
      const payload = {
        datasourceKey: `${datasource.id}__${datasource.type}`,
        sql: datasource.sql,
      };
      postForm('/superset/sqllab/', payload);
    }
  }

  render() {
    const { showChangeDatasourceModal, showEditDatasourceModal } = this.state;
    const { datasource, onChange } = this.props;
    const isMissingDatasource = datasource.id == null;

    const isSqlSupported = datasource.type === 'table';

    const datasourceMenu = (
      <Menu onClick={this.handleMenuItemClick}>
        {this.props.isEditable && (
          <Menu.Item key={EDIT_DATASET} data-test="edit-dataset">
            {t('Edit dataset')}
          </Menu.Item>
        )}
        <Menu.Item key={CHANGE_DATASET}>{t('Change dataset')}</Menu.Item>
        {isSqlSupported && (
          <Menu.Item key={VIEW_IN_SQL_LAB}>{t('View in SQL Lab')}</Menu.Item>
        )}
      </Menu>
    );

    const { health_check_message: healthCheckMessage } = datasource;

    let extra = {};
    if (datasource?.extra) {
      try {
        extra = JSON.parse(datasource?.extra);
      } catch {} // eslint-disable-line no-empty
    }

    return (
      <Styles data-test="datasource-control" className="DatasourceControl">
        <div className="data-container">
          <Icons.DatasetPhysical className="dataset-svg" />
          {/* Add a tooltip only for long dataset names */}
          {!isMissingDatasource && datasource.name.length > 25 ? (
            <Tooltip title={datasource.name}>
              <span className="title-select">{datasource.name}</span>
            </Tooltip>
          ) : (
            <span title={datasource.name} className="title-select">
              {datasource.name}
            </span>
          )}
          {healthCheckMessage && (
            <Tooltip title={healthCheckMessage}>
              <Icons.AlertSolid iconColor={supersetTheme.colors.warning.base} />
            </Tooltip>
          )}
          {extra?.warning_markdown && (
            <WarningIconWithTooltip warningMarkdown={extra.warning_markdown} />
          )}
          <Dropdown
            overlay={datasourceMenu}
            trigger={['click']}
            data-test="datasource-menu"
          >
            <Tooltip title={t('More dataset related options')}>
              <Icons.MoreVert
                className="datasource-modal-trigger"
                data-test="datasource-menu-trigger"
              />
            </Tooltip>
          </Dropdown>
        </div>
        {/* missing dataset */}
        {isMissingDatasource && (
          <div className="error-alert">
            <ErrorAlert
              level="warning"
              title={t('Missing dataset')}
              source="explore"
              subtitle={
                <>
                  <p>
                    {t(
                      'The dataset linked to this chart may have been deleted.',
                    )}
                  </p>
                  <p>
                    <Button
                      buttonStyle="primary"
                      onClick={() =>
                        this.handleMenuItemClick({ key: CHANGE_DATASET })
                      }
                    >
                      {t('Change dataset')}
                    </Button>
                  </p>
                </>
              }
            />
          </div>
        )}
        {showEditDatasourceModal && (
          <DatasourceModal
            datasource={datasource}
            show={showEditDatasourceModal}
            onDatasourceSave={this.onDatasourceSave}
            onHide={this.toggleEditDatasourceModal}
          />
        )}
        {showChangeDatasourceModal && (
          <ChangeDatasourceModal
            onDatasourceSave={this.onDatasourceSave}
            onHide={this.toggleChangeDatasourceModal}
            show={showChangeDatasourceModal}
            onChange={onChange}
          />
        )}
      </Styles>
    );
  }
}

DatasourceControl.propTypes = propTypes;
DatasourceControl.defaultProps = defaultProps;

export default DatasourceControl;
