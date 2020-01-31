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
import React, { useState, useEffect, useRef } from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import {
  Button,
  Modal,
  Row,
  Col,
  FormControl,
  FormGroup,
} from 'react-bootstrap';
import Dialog from 'react-bootstrap-dialog';
import Select from 'react-select';
import { t } from '@superset-ui/translation';
import { SupersetClient } from '@superset-ui/connection';

import { sliceUpdated } from '../actions/exploreActions';
import getClientErrorObject from '../../utils/getClientErrorObject';

function PropertiesModalWrapper({ show, onHide, animation, slice, onSave }) {
  // The wrapper is a separate component so that hooks only run when the modal opens
  return (
    <Modal show={show} onHide={onHide} animation={animation} bsSize="large">
      <PropertiesModal slice={slice} onHide={onHide} onSave={onSave} />
    </Modal>
  );
}

function PropertiesModal({ slice, onHide, onSave }) {
  const [submitting, setSubmitting] = useState(false);
  const errorDialog = useRef();
  const [ownerOptions, setOwnerOptions] = useState(null);

  // values of form inputs
  const [name, setName] = useState(slice.slice_name || '');
  const [description, setDescription] = useState(slice.description || '');
  const [cacheTimeout, setCacheTimeout] = useState(
    slice.cache_timeout != null ? slice.cache_timeout : '',
  );
  const [owners, setOwners] = useState(null);

  function showError({ error, statusText }) {
    errorDialog.current.show({
      title: 'Error',
      bsSize: 'medium',
      bsStyle: 'danger',
      actions: [Dialog.DefaultAction('Ok', () => {}, 'btn-danger')],
      body: error || statusText || t('An error has occurred'),
    });
  }

  async function fetchOwners() {
    try {
      const response = await SupersetClient.get({
        endpoint: `/api/v1/chart/${slice.slice_id}`,
      });
      setOwners(
        response.json.result.owners.map(owner => ({
          value: owner.id,
          label: owner.username,
        })),
      );
    } catch (response) {
      const clientError = await getClientErrorObject(response);
      showError(clientError);
    }
  }

  // get the owners of this slice
  useEffect(() => {
    fetchOwners();
  }, []);

  // get the list of users who can own a chart
  useEffect(() => {
    SupersetClient.get({
      endpoint: `/api/v1/chart/related/owners`,
    }).then(res => {
      setOwnerOptions(
        res.json.result.map(item => ({
          value: item.value,
          label: item.text,
        })),
      );
    });
  }, []);

  const onSubmit = async event => {
    event.stopPropagation();
    event.preventDefault();
    setSubmitting(true);
    const payload = {
      slice_name: name || null,
      description: description || null,
      cache_timeout: cacheTimeout || null,
      owners: owners.map(o => o.value),
    };
    try {
      const res = await SupersetClient.put({
        endpoint: `/api/v1/chart/${slice.slice_id}`,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      // update the redux state
      onSave(res.json.result);
      onHide();
    } catch (res) {
      const clientError = await getClientErrorObject(res);
      showError(clientError);
    }
    setSubmitting(false);
  };

  return (
    <form onSubmit={onSubmit}>
      <Modal.Header closeButton>
        <Modal.Title>Edit Chart Properties</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Row>
          <Col md={6}>
            <h3>{t('Basic Information')}</h3>
            <FormGroup>
              <label className="control-label" htmlFor="name">
                {t('Name')}
              </label>
              <FormControl
                name="name"
                type="text"
                bsSize="sm"
                value={name}
                onChange={event => setName(event.target.value)}
              />
            </FormGroup>
            <FormGroup>
              <label className="control-label" htmlFor="description">
                {t('Description')}
              </label>
              <FormControl
                name="description"
                type="text"
                componentClass="textarea"
                bsSize="sm"
                value={description}
                onChange={event => setDescription(event.target.value)}
                style={{ maxWidth: '100%' }}
              />
              <p className="help-block">
                {t(
                  'The description can be displayed as widget headers in the dashboard view. Supports markdown.',
                )}
              </p>
            </FormGroup>
          </Col>
          <Col md={6}>
            <h3>{t('Configuration')}</h3>
            <FormGroup>
              <label className="control-label" htmlFor="cacheTimeout">
                {t('Cache Timeout')}
              </label>
              <FormControl
                name="cacheTimeout"
                type="text"
                bsSize="sm"
                value={cacheTimeout}
                onChange={event =>
                  setCacheTimeout(event.target.value.replace(/[^0-9]/, ''))
                }
              />
              <p className="help-block">
                {t(
                  'Duration (in seconds) of the caching timeout for this chart. Note this defaults to the datasource/table timeout if undefined.',
                )}
              </p>
            </FormGroup>
            <h3 style={{ marginTop: '1em' }}>{t('Access')}</h3>
            <FormGroup>
              <label className="control-label" htmlFor="owners">
                {t('Owners')}
              </label>
              <Select
                name="owners"
                multi
                isLoading={!ownerOptions}
                value={owners}
                options={ownerOptions || []}
                onChange={setOwners}
                disabled={!owners || !ownerOptions}
              />
              <p className="help-block">
                {t('A list of users who can alter the chart')}
              </p>
            </FormGroup>
          </Col>
        </Row>
      </Modal.Body>
      <Modal.Footer>
        <Button
          type="submit"
          bsSize="sm"
          bsStyle="primary"
          className="m-r-5"
          disabled={submitting}
        >
          {t('Save')}
        </Button>
        <Button type="button" bsSize="sm" onClick={onHide}>
          {t('Cancel')}
        </Button>
        <Dialog ref={errorDialog} />
      </Modal.Footer>
    </form>
  );
}

function mapDispatchToProps(dispatch) {
  return bindActionCreators({ onSave: sliceUpdated }, dispatch);
}

export { PropertiesModalWrapper };
export default connect(null, mapDispatchToProps)(PropertiesModalWrapper);
