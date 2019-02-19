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
  Label,
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

const propTypes = {
  onChange: PropTypes.func,
  value: PropTypes.string,
  datasource: PropTypes.object.isRequired,
  onDatasourceSave: PropTypes.func,
};

const defaultProps = {
  onChange: () => {},
  onDatasourceSave: () => {},
  value: null,
};

class DatasourceControl extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      showEditDatasourceModal: false,
      loading: true,
      showDatasource: false,
      datasources: null,
    };
    this.toggleShowDatasource = this.toggleShowDatasource.bind(this);
    this.toggleEditDatasourceModal = this.toggleEditDatasourceModal.bind(this);
    this.renderDatasource = this.renderDatasource.bind(this);
  }

  toggleShowDatasource() {
    this.setState(({ showDatasource }) => ({ showDatasource: !showDatasource }));
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
    return (
      <div>
        <ControlHeader {...this.props} />
        <OverlayTrigger
          placement="right"
          overlay={
            <Tooltip id={'error-tooltip'}>{t('Click to edit the datasource')}</Tooltip>
          }
        >
          <Label onClick={this.toggleEditDatasourceModal} style={{ cursor: 'pointer' }} className="m-r-5">
            {this.props.datasource.name}
          </Label>
        </OverlayTrigger>
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
              className={`fa fa-${this.state.showDatasource ? 'minus' : 'plus'}-square m-r-5`}
              onClick={this.toggleShowDatasource}
            />
          </a>
        </OverlayTrigger>
        {this.props.datasource.type === 'table' &&
          <OverlayTrigger
            placement="right"
            overlay={
              <Tooltip id={'datasource-sqllab'}>
                {t('Explore this datasource in SQL Lab')}
              </Tooltip>
            }
          >
            <a
              href={`/superset/sqllab?datasourceKey=${this.props.value}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <i className="fa fa-flask m-r-5" />
            </a>
          </OverlayTrigger>}
        <Collapse in={this.state.showDatasource}>{this.renderDatasource()}</Collapse>
        <DatasourceModal
          datasource={this.props.datasource}
          show={this.state.showEditDatasourceModal}
          onDatasourceSave={this.props.onDatasourceSave}
          onHide={this.toggleEditDatasourceModal}
        />
      </div>
    );
  }
}

DatasourceControl.propTypes = propTypes;
DatasourceControl.defaultProps = defaultProps;

export default DatasourceControl;
