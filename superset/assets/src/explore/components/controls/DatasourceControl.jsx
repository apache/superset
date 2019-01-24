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
  Label,
  OverlayTrigger,
  Tooltip,
} from 'react-bootstrap';
import { t } from '@superset-ui/translation';

import ControlHeader from '../ControlHeader';
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
  }

  onChange(vizType) {
    this.props.onChange(vizType);
    this.setState({ showModal: false });
  }

  toggleShowDatasource() {
    this.setState(({ showDatasource }) => ({ showDatasource: !showDatasource }));
  }

  toggleModal() {
    this.setState(({ showModal }) => ({ showModal: !showModal }));
  }
  toggleEditDatasourceModal() {
    this.setState(({ showEditDatasourceModal }) => ({
      showEditDatasourceModal: !showEditDatasourceModal,
    }));
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
