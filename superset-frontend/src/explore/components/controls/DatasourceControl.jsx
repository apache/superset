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
import { Col, Collapse, Row, Well } from 'react-bootstrap';
import { t, styled } from '@superset-ui/core';
import { ColumnOption, MetricOption } from '@superset-ui/chart-controls';

import { Dropdown, Menu } from 'src/common/components';
import Tooltip from 'src/common/components/Tooltip';
import Icon from 'src/components/Icon';
import ChangeDatasourceModal from 'src/datasource/ChangeDatasourceModal';
import DatasourceModal from 'src/datasource/DatasourceModal';
import Label from 'src/components/Label';

import ControlHeader from '../ControlHeader';

const propTypes = {
  actions: PropTypes.object.isRequired,
  onChange: PropTypes.func,
  value: PropTypes.string,
  datasource: PropTypes.object.isRequired,
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
  .ant-dropdown-trigger {
    margin-left: ${({ theme }) => theme.gridUnit}px;
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
    vertical-align: middle;
    cursor: pointer;
  }
`;

/**
 * <Col> used in column details.
 */
const ColumnsCol = styled(Col)`
  overflow: auto; /* for very very long columns names */
  white-space: nowrap; /* make sure tooltip trigger is on the same line as the metric */
  .and-more {
    padding-left: 38px;
  }
`;

const CHANGE_DATASET = 'change_dataset';
const EXPLORE_IN_SQL_LAB = 'explore_in_sql_lab';
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
    this.renderDatasource = this.renderDatasource.bind(this);
    this.handleMenuItemClick = this.handleMenuItemClick.bind(this);
  }

  onDatasourceSave(datasource) {
    this.props.actions.setDatasource(datasource);
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
  }

  renderDatasource() {
    const { datasource } = this.props;
    const { showDatasource } = this.state;
    const maxNumColumns = 50;
    return (
      <div className="m-t-10">
        <Well className="m-t-0">
          <div className="m-b-10">
            <Label>
              <i className="fa fa-database" /> {datasource.database.backend}
            </Label>
            {` ${datasource.database.name} `}
          </div>
          {showDatasource && (
            <Row className="datasource-container">
              <ColumnsCol md={6}>
                <strong>Columns</strong>
                {datasource.columns.slice(0, maxNumColumns).map(col => (
                  <div key={col.column_name}>
                    <ColumnOption showType column={col} />
                  </div>
                ))}
                {datasource.columns.length > maxNumColumns && (
                  <div className="and-more">...</div>
                )}
              </ColumnsCol>
              <ColumnsCol md={6}>
                <strong>Metrics</strong>
                {datasource.metrics.slice(0, maxNumColumns).map(m => (
                  <div key={m.metric_name}>
                    <MetricOption metric={m} showType />
                  </div>
                ))}
                {datasource.columns.length > maxNumColumns && (
                  <div className="and-more">...</div>
                )}
              </ColumnsCol>
            </Row>
          )}
        </Well>
      </div>
    );
  }

  render() {
    const {
      showChangeDatasourceModal,
      showEditDatasourceModal,
      showDatasource,
    } = this.state;
    const { datasource, onChange, value } = this.props;

    const datasourceMenu = (
      <Menu onClick={this.handleMenuItemClick}>
        <Menu.Item key={CHANGE_DATASET}>{t('Change Dataset')}</Menu.Item>
        <Menu.Item key={EXPLORE_IN_SQL_LAB}>
          <a
            href={`/superset/sqllab?datasourceKey=${value}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t('Explore in SQL Lab')}
          </a>
        </Menu.Item>
        {this.props.isEditable && (
          <Menu.Item key={EDIT_DATASET} data-test="edit-dataset">
            {t('Edit Dataset')}
          </Menu.Item>
        )}
      </Menu>
    );

    return (
      <Styles className="DatasourceControl">
        <ControlHeader {...this.props} />
        <div>
          <Tooltip title={t('Expand/collapse dataset configuration')}>
            <Label
              style={{ textTransform: 'none' }}
              onClick={this.toggleShowDatasource}
            >
              {datasource.name}{' '}
              <i
                className={`angle fa fa-angle-${
                  showDatasource ? 'up' : 'down'
                }`}
              />
            </Label>
          </Tooltip>
          <Dropdown
            overlay={datasourceMenu}
            trigger={['click']}
            data-test="datasource-menu"
          >
            <Tooltip title={t('More dataset related options')}>
              <Icon
                className="datasource-modal-trigger"
                data-test="datasource-menu-trigger"
                name="more-horiz"
              />
            </Tooltip>
          </Dropdown>
        </div>
        <Collapse in={this.state.showDatasource}>
          {this.renderDatasource()}
        </Collapse>
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
