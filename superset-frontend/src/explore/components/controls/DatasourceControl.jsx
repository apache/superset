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
  Col,
  Collapse,
  DropdownButton,
  MenuItem,
  OverlayTrigger,
  Row,
  Tooltip,
  Well,
} from 'react-bootstrap';
import { t, styled } from '@superset-ui/core';
import { ColumnOption, MetricOption } from '@superset-ui/chart-controls';

import TooltipWrapper from 'src/components/TooltipWrapper';

import Icon from 'src/components/Icon';
import ChangeDatasourceModal from 'src/datasource/ChangeDatasourceModal';
import DatasourceModal from 'src/datasource/DatasourceModal';
import Label from 'src/components/Label';

import ControlHeader from '../ControlHeader';
import './DatasourceControl.less';

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
  #datasource_menu {
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
`;

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

  renderDatasource() {
    const { datasource } = this.props;
    return (
      <div className="m-t-10">
        <Well className="m-t-0">
          <div className="m-b-10">
            <Label>
              <i className="fa fa-database" /> {datasource.database.backend}
            </Label>
            {` ${datasource.database.name} `}
          </div>
          <Row className="datasource-container">
            <Col md={6}>
              <strong>Columns</strong>
              {datasource.columns.map(col => (
                <div key={col.column_name}>
                  <ColumnOption showType column={col} />
                </div>
              ))}
            </Col>
            <Col md={6}>
              <strong>Metrics</strong>
              {datasource.metrics.map(m => (
                <div key={m.metric_name}>
                  <MetricOption metric={m} showType />
                </div>
              ))}
            </Col>
          </Row>
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
    return (
      <Styles className="DatasourceControl">
        <ControlHeader {...this.props} />
        <div>
          <OverlayTrigger
            placement="top"
            overlay={
              <Tooltip id="toggle-datasource-tooltip">
                {t('Expand/collapse datasource configuration')}
              </Tooltip>
            }
          >
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
          </OverlayTrigger>
          <TooltipWrapper
            label="change-datasource"
            tooltip={t('more dataset related options')}
            trigger={['hover']}
          >
            <DropdownButton
              title={<Icon name="more-horiz" />}
              className=""
              bsSize="sm"
              id="datasource_menu"
            >
              <MenuItem eventKey="3" onClick={this.toggleChangeDatasourceModal}>
                {t('Change Datasource')}
              </MenuItem>
              {datasource.type === 'table' && (
                <MenuItem
                  eventKey="3"
                  href={`/superset/sqllab?datasourceKey=${value}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t('Explore in SQL Lab')}
                </MenuItem>
              )}
              {this.props.isEditable && (
                <MenuItem eventKey="3" onClick={this.toggleEditDatasourceModal}>
                  {t('Edit Datasource')}
                </MenuItem>
              )}
            </DropdownButton>
          </TooltipWrapper>
        </div>
        <Collapse in={this.state.showDatasource}>
          {this.renderDatasource()}
        </Collapse>
        <DatasourceModal
          datasource={datasource}
          show={showEditDatasourceModal}
          onDatasourceSave={this.onDatasourceSave}
          onHide={this.toggleEditDatasourceModal}
        />
        <ChangeDatasourceModal
          onDatasourceSave={this.onDatasourceSave}
          onHide={this.toggleChangeDatasourceModal}
          show={showChangeDatasourceModal}
          onChange={onChange}
        />
      </Styles>
    );
  }
}

DatasourceControl.propTypes = propTypes;
DatasourceControl.defaultProps = defaultProps;

export default DatasourceControl;
