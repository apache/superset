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
import { Table } from 'reactable-arc';
import { Alert, FormControl, Modal } from 'react-bootstrap';
import { SupersetClient } from '@superset-ui/connection';
import { t } from '@superset-ui/translation';

import getClientErrorObject from '../utils/getClientErrorObject';
import Loading from '../components/Loading';
import withToasts from '../messageToasts/enhancers/withToasts';

const propTypes = {
  addDangerToast: PropTypes.func.isRequired,
  onChange: PropTypes.func,
  onDatasourceSave: PropTypes.func,
  onHide: PropTypes.func,
  show: PropTypes.bool.isRequired,
};

const defaultProps = {
  onChange: () => {},
  onDatasourceSave: () => {},
  onHide: () => {},
};

const TABLE_COLUMNS = ['name', 'type', 'schema', 'connection', 'creator'];
const TABLE_FILTERABLE = ['rawName', 'type', 'schema', 'connection', 'creator'];
const CHANGE_WARNING_MSG = t(
  'Changing the datasource may break the chart if the chart relies ' +
    'on columns or metadata that does not exist in the target datasource',
);

class ChangeDatasourceModal extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      loading: true,
      datasources: null,
    };
    this.setSearchRef = this.setSearchRef.bind(this);
    this.onEnterModal = this.onEnterModal.bind(this);
    this.selectDatasource = this.selectDatasource.bind(this);
    this.changeSearch = this.changeSearch.bind(this);
  }

  onEnterModal() {
    if (this.searchRef) {
      this.searchRef.focus();
    }
    if (!this.state.datasources) {
      SupersetClient.get({
        endpoint: '/superset/datasources/',
      })
        .then(({ json }) => {
          const datasources = json.map(ds => ({
            rawName: ds.name,
            connection: ds.connection,
            schema: ds.schema,
            name: (
              <a
                href="#"
                onClick={this.selectDatasource.bind(this, ds)}
                className="datasource-link"
              >
                {ds.name}
              </a>
            ),
            type: ds.type,
          }));

          this.setState({ loading: false, datasources });
        })
        .catch(response => {
          this.setState({ loading: false });
          getClientErrorObject(response).then(({ error }) => {
            this.props.addDangerToast(error.error || error.statusText || error);
          });
        });
    }
  }

  setSearchRef(searchRef) {
    this.searchRef = searchRef;
  }

  changeSearch(event) {
    this.setState({ filter: event.target.value });
  }

  selectDatasource(datasource) {
    SupersetClient.get({
      endpoint: `/datasource/get/${datasource.type}/${datasource.id}`,
    })
      .then(({ json }) => {
        this.props.onDatasourceSave(json);
        this.props.onChange(datasource.uid);
      })
      .catch(response => {
        getClientErrorObject(response).then(({ error, message }) => {
          const errorMessage = error
            ? error.error || error.statusText || error
            : message;
          this.props.addDangerToast(errorMessage);
        });
      });
    this.props.onHide();
  }

  render() {
    const { datasources, filter, loading } = this.state;
    const { show, onHide } = this.props;

    return (
      <Modal
        show={show}
        onHide={onHide}
        onEnter={this.onEnterModal}
        onExit={this.setSearchRef}
        bsSize="lg"
      >
        <Modal.Header closeButton>
          <Modal.Title>{t('Select a datasource')}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Alert bsStyle="warning" showIcon>
            <strong>{t('Warning!')}</strong> {CHANGE_WARNING_MSG}
          </Alert>
          <div>
            <FormControl
              inputRef={ref => {
                this.setSearchRef(ref);
              }}
              type="text"
              bsSize="sm"
              value={filter}
              placeholder={t('Search / Filter')}
              onChange={this.changeSearch}
            />
          </div>
          {loading && <Loading />}
          {datasources && (
            <Table
              columns={TABLE_COLUMNS}
              className="table table-condensed"
              data={datasources}
              itemsPerPage={20}
              filterable={TABLE_FILTERABLE}
              filterBy={filter}
              hideFilterInput
            />
          )}
        </Modal.Body>
      </Modal>
    );
  }
}

ChangeDatasourceModal.propTypes = propTypes;
ChangeDatasourceModal.defaultProps = defaultProps;

export default withToasts(ChangeDatasourceModal);
