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

import { PureComponent } from 'react';
import PropTypes from 'prop-types';
import {
  DatasourceType,
  SupersetClient,
  styled,
  t,
  withTheme,
} from '@superset-ui/core';
import { getTemporalColumns } from '@superset-ui/chart-controls';
import { getUrlParam } from 'src/utils/urlUtils';
import { Dropdown } from 'src/components/Dropdown';
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
import {
  userHasPermission,
  isUserAdmin,
} from 'src/dashboard/util/permissionUtils';
import ModalTrigger from 'src/components/ModalTrigger';
import ViewQueryModalFooter from 'src/explore/components/controls/ViewQueryModalFooter';
import ViewQuery from 'src/explore/components/controls/ViewQuery';
import { SaveDatasetModal } from 'src/SqlLab/components/SaveDatasetModal';
import { safeStringify } from 'src/utils/safeStringify';
import { Link } from 'react-router-dom';

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
  .antd5-dropdown-trigger {
    margin-left: ${({ theme }) => 2 * theme.gridUnit}px;
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

// Assign icon for each DatasourceType.  If no icon assignment is found in the lookup, no icon will render
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

const preventRouterLinkWhileMetaClicked = evt => {
  if (evt.metaKey) {
    evt.preventDefault();
  } else {
    evt.stopPropagation();
  }
};

class DatasourceControl extends PureComponent {
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
    const { temporalColumns, defaultTemporalColumn } =
      getTemporalColumns(datasource);
    const { columns } = datasource;
    // the current granularity_sqla might not be a temporal column anymore
    const timeCol = this.props.form_data?.granularity_sqla;
    const isGranularitySqlaTemporal = columns.find(
      ({ column_name }) => column_name === timeCol,
    )?.is_dttm;
    // the current main_dttm_col might not be a temporal column anymore
    const isDefaultTemporal = columns.find(
      ({ column_name }) => column_name === defaultTemporalColumn,
    )?.is_dttm;

    // if the current granularity_sqla is empty or it is not a temporal column anymore
    // let's update the control value
    if (datasource.type === 'table' && !isGranularitySqlaTemporal) {
      const temporalColumn = isDefaultTemporal
        ? defaultTemporalColumn
        : temporalColumns?.[0];
      this.props.actions.setControlValue(
        'granularity_sqla',
        temporalColumn || null,
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
          SupersetClient.postForm('/sqllab/', {
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
    const isMissingDatasource = !datasource?.id;
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

    const canAccessSqlLab = userHasPermission(user, 'SQL Lab', 'menu_access');

    const editText = t('Edit dataset');
    const requestedQuery = {
      datasourceKey: `${datasource.id}__${datasource.type}`,
      sql: datasource.sql,
    };

    const defaultDatasourceMenu = (
      <Menu onClick={this.handleMenuItemClick}>
        {this.props.isEditable && !isMissingDatasource && (
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
        <Menu.Item key={CHANGE_DATASET}>{t('Swap dataset')}</Menu.Item>
        {!isMissingDatasource && canAccessSqlLab && (
          <Menu.Item key={VIEW_IN_SQL_LAB}>
            <Link
              to={{
                pathname: '/sqllab',
                state: { requestedQuery },
              }}
              onClick={preventRouterLinkWhileMetaClicked}
            >
              {t('View in SQL Lab')}
            </Link>
          </Menu.Item>
        )}
      </Menu>
    );

    const queryDatasourceMenu = (
      <Menu onClick={this.handleMenuItemClick}>
        <Menu.Item key={QUERY_PREVIEW}>
          <ModalTrigger
            triggerNode={
              <div data-test="view-query-menu-item">{t('Query preview')}</div>
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
        {canAccessSqlLab && (
          <Menu.Item key={VIEW_IN_SQL_LAB}>
            <Link
              to={{
                pathname: '/sqllab',
                state: { requestedQuery },
              }}
              onClick={preventRouterLinkWhileMetaClicked}
            >
              {t('View in SQL Lab')}
            </Link>
          </Menu.Item>
        )}
        <Menu.Item key={SAVE_AS_DATASET}>{t('Save as dataset')}</Menu.Item>
      </Menu>
    );

    const { health_check_message: healthCheckMessage } = datasource;

    let extra;
    if (datasource?.extra) {
      if (typeof datasource.extra === 'string') {
        try {
          extra = JSON.parse(datasource.extra);
        } catch {} // eslint-disable-line no-empty
      } else {
        extra = datasource.extra; // eslint-disable-line prefer-destructuring
      }
    }

    const titleText = isMissingDatasource
      ? t('Missing dataset')
      : getDatasourceTitle(datasource);

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
          <Dropdown
            dropdownRender={() =>
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
          </Dropdown>
        </div>
        {/* missing dataset */}
        {isMissingDatasource && isMissingParams && (
          <div className="error-alert">
            <ErrorAlert
              level="warning"
              errorType={t('Missing URL parameters')}
              description={t(
                'The URL is missing the dataset_id or slice_id parameters.',
              )}
            />
          </div>
        )}
        {isMissingDatasource && !isMissingParams && (
          <div className="error-alert">
            <ErrorAlert
              level="warning"
              errorType={t('Missing dataset')}
              description={
                <>
                  {t('The dataset linked to this chart may have been deleted.')}
                  <Button
                    buttonStyle="primary"
                    onClick={() =>
                      this.handleMenuItemClick({ key: CHANGE_DATASET })
                    }
                  >
                    {t('Swap dataset')}
                  </Button>
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
