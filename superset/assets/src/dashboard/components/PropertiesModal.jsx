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
import { Alert, Button, Modal, FormControl } from 'react-bootstrap';
import Dialog from 'react-bootstrap-dialog';
import Select from 'react-select';
import { t } from '@superset-ui/translation';
import { SupersetClient } from '@superset-ui/connection';

import getClientErrorObject from '../../utils/getClientErrorObject';
import withToasts from '../../messageToasts/enhancers/withToasts';


const propTypes = {
  dashboardTitle: PropTypes.string,
  dashboardInfo: PropTypes.object,
  owners: PropTypes.arrayOf(PropTypes.object),
  show: PropTypes.bool.isRequired,
  onHide: PropTypes.func,
  onDashboardSave: PropTypes.func,
  addSuccessToast: PropTypes.func.isRequired,
};

const defaultProps = {
  dashboardInfo: {},
  dashboardTitle: '[dashboard name]',
  onHide: () => {},
  onDashboardSave: () => {},
  show: false,
};

class PropertiesModal extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      errors: [],
      values: {
        dashboardTitle: this.props.dashboardTitle,
        slug: this.props.dashboardInfo.slug,
        owners: this.props.owners || [],
      },
      userOptions: null,
    };
    console.log(props);
    this.onChange = this.onChange.bind(this);
    this.onOwnersChange = this.onOwnersChange.bind(this);
    this.save = this.save.bind(this);
    this.setDialogRef = this.setDialogRef.bind(this);
  }

  componentDidMount() {
    SupersetClient.get({ endpoint: `/users/api/read` })
    .then(response => {
      const options = response.json.result.map((user, i) => ({
        // ids are in a separate `pks` array in the results... need api v2
        value: response.json.pks[i],
        label: user.first_name + ' ' + user.last_name,
      }))
      this.setState({
        userOptions: options,
      });
    })
  }

  componentDidUpdate(prevProps) {
    if (this.props.dashboardInfo !== prevProps.dashboardInfo) {
      this.setState({
        values: {
          dashboard_title: this.props.dashboardInfo.title,
          slug: this.props.dashboardInfo.slug,
          owners: this.props.dashboardInfo.owners,
        },
      });
    }
  }

  onOwnersChange(value) {
    console.log(value);
    this.setState((state) => ({
      values: {
        ...state.values,
        owners: value,
      }
    }));
  }

  onChange(e) {
    const { name, value } = e.target;
    this.setState((state) => ({
      values: {
        ...state.values,
        [name]: value,
      },
    }));
  }

  save(e) {
    e.preventDefault()
    e.stopPropagation()
    console.log('saving!')
    const owners = this.state.values.owners.map(o => o.value);
    SupersetClient.put({
      endpoint: `/dashboard/api/update/${this.props.dashboardInfo.id}`,
      postPayload: {
        ...this.state.values,
        owners,
      },
    })
      .then(({ json }) => {
        this.props.addSuccessToast(t('The dashboard has been saved'));
        this.props.onDashboardSave(json);
        this.props.onHide();
      })
      .catch(response =>
        console.log(response) ||
        getClientErrorObject(response).then(({ error, statusText }) => {
          this.dialog.show({
            title: 'Error',
            bsSize: 'medium',
            bsStyle: 'danger',
            actions: [
              Dialog.DefaultAction('Ok', () => {}, 'btn-danger'),
            ],
            body: error || statusText || t('An error has occurred'),
          });
        }),
      );
  }

  setDialogRef(ref) {
    this.dialog = ref;
  }

  render() {
    const { userOptions, values } = this.state;
    console.log(values)
    return (
      <Modal
        show={this.props.show}
        onHide={this.props.onHide}
        bsSize="lg"
      >
        <form onSubmit={this.save}>
          <Modal.Header closeButton>
            <Modal.Title>
              <div>
                <span className="float-left">
                  {t('Dashboard Properties')}
                </span>
              </div>
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <div>
              <FormControl
                name="dashboard_title"
                type="text"
                bsSize="sm"
                value={values.dashboard_title}
                placeholder={t('Title')}
                onChange={this.onChange}
              />
              <FormControl
                name="slug"
                type="text"
                bsSize="sm"
                value={values.slug}
                placeholder={t('URL Slug')}
                onChange={this.onChange}
              />
              {userOptions && (
                <Select
                  name="owners"
                  placeholder="Owners"
                  multi
                  isLoading={!userOptions}
                  value={values.owners}
                  options={userOptions || []}
                  onChange={this.onOwnersChange}
                />
              )}

            </div>
          </Modal.Body>
          <Modal.Footer>
            <span className="float-right">
              <Button
                type="submit"
                bsSize="sm"
                bsStyle="primary"
                className="m-r-5"
                disabled={this.state.errors.length > 0}
              >
                {t('Save')}
              </Button>
              <Button type="button" bsSize="sm" onClick={this.props.onHide}>{t('Cancel')}</Button>
              <Dialog ref={this.setDialogRef} />
            </span>
          </Modal.Footer>
        </form>
      </Modal>);
  }
}

PropertiesModal.propTypes = propTypes;
PropertiesModal.defaultProps = defaultProps;

export default withToasts(PropertiesModal);
