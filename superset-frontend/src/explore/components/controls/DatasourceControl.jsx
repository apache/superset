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
  Label,
  MenuItem,
  OverlayTrigger,
  Row,
  Tooltip,
  Well,
} from 'react-bootstrap';
import { t } from '@superset-ui/translation';

import ControlHeader from '../ControlHeader';
import ColumnOption from '../../../components/ColumnOption';
import MetricOption from '../../../components/MetricOption';
import DatasourceModal from '../../../datasource/DatasourceModal';
import ChangeDatasourceModal from '../../../datasource/ChangeDatasourceModal';
import TooltipWrapper from '../../../components/TooltipWrapper';
import './DatasourceControl.less';

const propTypes = {
  onChange: PropTypes.func,
  value: PropTypes.string,
  datasource: PropTypes.object.isRequired,
  onDatasourceSave: PropTypes.func,
};

const defaultProps = {
  onChange: () => {},
  onDatasourceSave: null,
  value: null,
};

class DatasourceControl extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      showEditDatasourceModal: false,
      showChangeDatasourceModal: false,
      menuExpanded: false,
    };
    this.toggleChangeDatasourceModal = this.toggleChangeDatasourceModal.bind(
      this,
    );
    this.toggleEditDatasourceModal = this.toggleEditDatasourceModal.bind(this);
    this.toggleShowDatasource = this.toggleShowDatasource.bind(this);
    this.renderDatasource = this.renderDatasource.bind(this);
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
    const datasource = this.props.datasource;
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
    const { showChangeDatasourceModal, showEditDatasourceModal } = this.state;
    const { datasource, onChange, onDatasourceSave, value } = this.props;
    return (
      <div>
        <ControlHeader {...this.props} />
        <div className="btn-group label-dropdown">
          <TooltipWrapper
            label="change-datasource"
            tooltip={t('Click to change the datasource')}
          >
            <DropdownButton
              title={datasource.name}
              className="label label-default label-btn m-r-5"
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
              {!!this.props.onDatasourceSave && (
                <MenuItem eventKey="3" onClick={this.toggleEditDatasourceModal}>
                  {t('Edit Datasource')}
                </MenuItem>
              )}
            </DropdownButton>
          </TooltipWrapper>
          <OverlayTrigger
            placement="right"
            overlay={
              <Tooltip id={'toggle-datasource-tooltip'}>
                {t('Expand/collapse datasource configuration')}
              </Tooltip>
            }
          >
            <a href="#">
              <i
                className={`fa fa-${
                  this.state.showDatasource ? 'minus' : 'plus'
                }-square m-r-5 m-l-5 m-t-4`}
                onClick={this.toggleShowDatasource}
              />
            </a>
          </OverlayTrigger>
        </div>
        <Collapse in={this.state.showDatasource}>
          {this.renderDatasource()}
        </Collapse>
        <DatasourceModal
          datasource={datasource}
          show={showEditDatasourceModal}
          onDatasourceSave={onDatasourceSave}
          onHide={this.toggleEditDatasourceModal}
        />
        <ChangeDatasourceModal
          onDatasourceSave={onDatasourceSave}
          onHide={this.toggleChangeDatasourceModal}
          show={showChangeDatasourceModal}
          onChange={onChange}
        />
      </div>
    );
  }
}

DatasourceControl.propTypes = propTypes;
DatasourceControl.defaultProps = defaultProps;

export default DatasourceControl;
