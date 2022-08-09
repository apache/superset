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
import {
  DatasourceType,
  SupersetClient,
  styled,
  t,
  withTheme,
} from '@superset-ui/core';

import { getUrlParam } from 'src/utils/urlUtils';
import { AntdDropdown } from 'src/components';
import { Menu } from 'src/components/Menu';
import { Tooltip } from 'src/components/Tooltip';
import Icons from 'src/components/Icons';
import {
  ChangeDatasourceModal,
  DatasourceModal,
} from 'src/components/Datasource';
import Button from 'src/components/Button';
import ErrorAlert from 'src/components/ErrorMessage/ErrorAlert';
import WarningIconWithTooltip from 'src/components/WarningIconWithTooltip';
import { URL_PARAMS } from 'src/constants';
import { getDatasourceAsSaveableDataset } from 'src/utils/datasourceUtils';
import { isUserAdmin } from 'src/dashboard/util/permissionUtils';
import ModalTrigger from 'src/components/ModalTrigger';
import ViewQueryModalFooter from 'src/explore/components/controls/ViewQueryModalFooter';
import ViewQuery from 'src/explore/components/controls/ViewQuery';
import { SaveDatasetModal } from 'src/SqlLab/components/SaveDatasetModal';
import { safeStringify } from 'src/utils/safeStringify';
import { isString } from 'lodash';

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
    padding: ${({ theme }) => 4 * theme.gridUnit}px;
    padding-right: ${({ theme }) => 2 * theme.gridUnit}px;
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
  .datasource-svg {
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
const QUERY_PREVIEW = 'query_preview';
const SAVE_AS_DATASET = 'save_as_dataset';

// If the string is longer than this value's number characters we add
// a tooltip for user can see the full name by hovering over the visually truncated string in UI
const VISIBLE_TITLE_LENGTH = 25;

// Assign icon for each DatasourceType.  If no icon assingment is found in the lookup, no icon will render
export const datasourceIconLookup = {
  [DatasourceType.Query]: (
    <Icons.ConsoleSqlOutlined className="datasource-svg" />
  ),
  [DatasourceType.Table]: <Icons.DatasetPhysical className="datasource-svg" />,
};

// Render title for datasource with tooltip only if text is longer than VISIBLE_TITLE_LENGTH
export const renderDatasourceTitle = (displayString, tooltip) =>
  displayString?.length > VISIBLE_TITLE_LENGTH ? (
    // Add a tooltip only for long names that will be visually truncated
    <Tooltip title={tooltip}>
      <span className="title-select">{displayString}</span>
    </Tooltip>
  ) : (
    <span title={tooltip} className="title-select">
      {displayString}
    </span>
  );

// Different data source types use different attributes for the display title
export const getDatasourceTitle = datasource => {
  if (datasource?.type === 'query') return datasource?.sql;
  return datasource?.name || '';
};

class DatasourceControl extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      showEditDatasourceModal: false,
      showChangeDatasourceModal: false,
      showSaveDatasetModal: false,
    };
  }

  onDatasourceSave = datasource => {
    this.props.actions.changeDatasource(datasource);
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
  };

  toggleShowDatasource = () => {
    this.setState(({ showDatasource }) => ({
      showDatasource: !showDatasource,
    }));
  };

  toggleChangeDatasourceModal = () => {
    this.setState(({ showChangeDatasourceModal }) => ({
      showChangeDatasourceModal: !showChangeDatasourceModal,
    }));
  };

  toggleEditDatasourceModal = () => {
    this.setState(({ showEditDatasourceModal }) => ({
      showEditDatasourceModal: !showEditDatasourceModal,
    }));
  };

  toggleSaveDatasetModal = () => {
    this.setState(({ showSaveDatasetModal }) => ({
      showSaveDatasetModal: !showSaveDatasetModal,
    }));
  };

  handleMenuItemClick = ({ key }) => {
    switch (key) {
      case CHANGE_DATASET:
        this.toggleChangeDatasourceModal();
        break;

      case EDIT_DATASET:
        this.toggleEditDatasourceModal();
        break;

      case VIEW_IN_SQL_LAB:
        {
          const { datasource } = this.props;
          const payload = {
            datasourceKey: `${datasource.id}__${datasource.type}`,
            sql: datasource.sql,
          };
          SupersetClient.postForm('/superset/sqllab/', {
            form_data: safeStringify(payload),
          });
        }
        break;

      case SAVE_AS_DATASET:
        this.toggleSaveDatasetModal();
        break;

      default:
        break;
    }
  };

  render() {
    const {
      showChangeDatasourceModal,
      showEditDatasourceModal,
      showSaveDatasetModal,
    } = this.state;
    const { datasource, onChange, theme } = this.props;
    const isMissingDatasource = datasource?.id == null;
    let isMissingParams = false;
    if (isMissingDatasource) {
      const datasourceId = getUrlParam(URL_PARAMS.datasourceId);
      const sliceId = getUrlParam(URL_PARAMS.sliceId);
      if (!datasourceId && !sliceId) {
        isMissingParams = true;
      }
    }

    const { user } = this.props;
    const allowEdit =
      datasource.owners?.map(o => o.id || o.value).includes(user.userId) ||
      isUserAdmin(user);

    const editText = t('Edit dataset');

    const defaultDatasourceMenu = (
      <Menu onClick={this.handleMenuItemClick}>
        {this.props.isEditable && (
          <Menu.Item
            key={EDIT_DATASET}
            data-test="edit-dataset"
            disabled={!allowEdit}
          >
            {!allowEdit ? (
              <Tooltip
                title={t(
                  'You must be a dataset owner in order to edit. Please reach out to a dataset owner to request modifications or edit access.',
                )}
              >
                {editText}
              </Tooltip>
            ) : (
              editText
            )}
          </Menu.Item>
        )}
        <Menu.Item key={CHANGE_DATASET}>{t('Change dataset')}</Menu.Item>
        {datasource && (
          <Menu.Item key={VIEW_IN_SQL_LAB}>{t('View in SQL Lab')}</Menu.Item>
        )}
      </Menu>
    );

    const queryDatasourceMenu = (
      <Menu onClick={this.handleMenuItemClick}>
        <Menu.Item key={QUERY_PREVIEW}>
          <ModalTrigger
            triggerNode={
              <span data-test="view-query-menu-item">{t('Query preview')}</span>
            }
            modalTitle={t('Query preview')}
            modalBody={
              <ViewQuery
                sql={datasource?.sql || datasource?.select_star || ''}
              />
            }
            modalFooter={
              <ViewQueryModalFooter
                changeDatasource={this.toggleSaveDatasetModal}
                datasource={datasource}
              />
            }
            draggable={false}
            resizable={false}
            responsive
          />
        </Menu.Item>
        <Menu.Item key={VIEW_IN_SQL_LAB}>{t('View in SQL Lab')}</Menu.Item>
        <Menu.Item key={SAVE_AS_DATASET}>{t('Save as dataset')}</Menu.Item>
      </Menu>
    );

    const { health_check_message: healthCheckMessage } = datasource;

    let extra;
    if (datasource?.extra) {
      if (isString(datasource.extra)) {
        try {
          extra = JSON.parse(datasource.extra);
        } catch {} // eslint-disable-line no-empty
      } else {
        extra = datasource.extra; // eslint-disable-line prefer-destructuring
      }
    }

    const titleText = getDatasourceTitle(datasource);
    const tooltip = titleText;

    return (
      <Styles data-test="datasource-control" className="DatasourceControl">
        <div className="data-container">
          {datasourceIconLookup[datasource?.type]}
          {renderDatasourceTitle(titleText, tooltip)}
          {healthCheckMessage && (
            <Tooltip title={healthCheckMessage}>
              <Icons.AlertSolid iconColor={theme.colors.warning.base} />
            </Tooltip>
          )}
          {extra?.warning_markdown && (
            <WarningIconWithTooltip warningMarkdown={extra.warning_markdown} />
          )}
          <AntdDropdown
            overlay={
              datasource.type === DatasourceType.Query
                ? queryDatasourceMenu
                : defaultDatasourceMenu
            }
            trigger={['click']}
            data-test="datasource-menu"
          >
            <Icons.MoreVert
              className="datasource-modal-trigger"
              data-test="datasource-menu-trigger"
            />
          </AntdDropdown>
        </div>
        {/* missing dataset */}
        {isMissingDatasource && isMissingParams && (
          <div className="error-alert">
            <ErrorAlert
              level="warning"
              title={t('Missing URL parameters')}
              source="explore"
              subtitle={
                <>
                  <p>
                    {t(
                      'The URL is missing the dataset_id or slice_id parameters.',
                    )}
                  </p>
                </>
              }
            />
          </div>
        )}
        {isMissingDatasource && !isMissingParams && (
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
        {showSaveDatasetModal && (
          <SaveDatasetModal
            visible={showSaveDatasetModal}
            onHide={this.toggleSaveDatasetModal}
            buttonTextOnSave={t('Save')}
            buttonTextOnOverwrite={t('Overwrite')}
            modalDescription={t(
              'Save this query as a virtual dataset to continue exploring',
            )}
            datasource={getDatasourceAsSaveableDataset(datasource)}
            openWindow={false}
            formData={this.props.form_data}
          />
        )}
      </Styles>
    );
  }
}

DatasourceControl.propTypes = propTypes;
DatasourceControl.defaultProps = defaultProps;

export default withTheme(DatasourceControl);
