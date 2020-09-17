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
import {
  Modal,
  Row,
  Col,
  FormControl,
  FormGroup,
  FormControlProps,
} from 'react-bootstrap';
import Button from 'src/components/Button';
import Dialog from 'react-bootstrap-dialog';
import { OptionsType } from 'react-select/src/types';
import { AsyncSelect } from 'src/components/Select';
import rison from 'rison';
import { t, SupersetClient } from '@superset-ui/core';
import Chart from 'src/types/Chart';
import FormLabel from 'src/components/FormLabel';
import getClientErrorObject from '../../utils/getClientErrorObject';

export type Slice = {
  id?: number;
  slice_id: number;
  slice_name: string;
  description: string | null;
  cache_timeout: number | null;
};

type InternalProps = {
  slice: Slice;
  onHide: () => void;
  onSave: (chart: Chart) => void;
};

type OwnerOption = {
  label: string;
  value: number;
};

export type WrapperProps = InternalProps & {
  show: boolean;
  animation?: boolean; // for the modal
};

function PropertiesModal({ slice, onHide, onSave }: InternalProps) {
  const [submitting, setSubmitting] = useState(false);
  const errorDialog = useRef<any>(null);

  // values of form inputs
  const [name, setName] = useState(slice.slice_name || '');
  const [description, setDescription] = useState(slice.description || '');
  const [cacheTimeout, setCacheTimeout] = useState(
    slice.cache_timeout != null ? slice.cache_timeout : '',
  );
  const [owners, setOwners] = useState<OptionsType<OwnerOption> | null>(null);

  function showError({ error, statusText }: any) {
    errorDialog.current.show({
      title: 'Error',
      bsSize: 'medium',
      bsStyle: 'danger',
      actions: [Dialog.DefaultAction('Ok', () => {}, 'btn-danger')],
      body: error || statusText || t('An error has occurred'),
    });
  }

  async function fetchChartData() {
    try {
      const response = await SupersetClient.get({
        endpoint: `/api/v1/chart/${slice.slice_id}`,
      });
      const chart = response.json.result;
      setOwners(
        chart.owners.map((owner: any) => ({
          value: owner.id,
          label: `${owner.first_name} ${owner.last_name}`,
        })),
      );
    } catch (response) {
      const clientError = await getClientErrorObject(response);
      showError(clientError);
    }
  }

  // get the owners of this slice
  useEffect(() => {
    fetchChartData();
  }, []);

  const loadOptions = (input = '') => {
    const query = rison.encode({
      filter: input,
    });
    return SupersetClient.get({
      endpoint: `/api/v1/chart/related/owners?q=${query}`,
    }).then(
      response => {
        const { result } = response.json;
        return result.map((item: any) => ({
          value: item.value,
          label: item.text,
        }));
      },
      badResponse => {
        getClientErrorObject(badResponse).then(showError);
        return [];
      },
    );
  };

  const onSubmit = async (event: React.FormEvent) => {
    event.stopPropagation();
    event.preventDefault();
    setSubmitting(true);
    const payload: { [key: string]: any } = {
      slice_name: name || null,
      description: description || null,
      cache_timeout: cacheTimeout || null,
    };
    if (owners) {
      payload.owners = owners.map(o => o.value);
    }
    try {
      const res = await SupersetClient.put({
        endpoint: `/api/v1/chart/${slice.slice_id}`,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      // update the redux state
      const updatedChart = {
        ...res.json.result,
        id: slice.slice_id,
      };
      onSave(updatedChart);
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
              <FormLabel htmlFor="name" required>
                {t('Name')}
              </FormLabel>
              <FormControl
                name="name"
                type="text"
                bsSize="sm"
                value={name}
                onChange={(
                  event: React.FormEvent<FormControl & FormControlProps>,
                ) => setName((event.currentTarget?.value as string) ?? '')}
              />
            </FormGroup>
            <FormGroup>
              <FormLabel htmlFor="description">{t('Description')}</FormLabel>
              <FormControl
                name="description"
                type="text"
                componentClass="textarea"
                bsSize="sm"
                value={description}
                onChange={(
                  event: React.FormEvent<FormControl & FormControlProps>,
                ) =>
                  setDescription((event.currentTarget?.value as string) ?? '')
                }
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
              <FormLabel htmlFor="cacheTimeout">{t('Cache Timeout')}</FormLabel>
              <FormControl
                name="cacheTimeout"
                type="text"
                bsSize="sm"
                value={cacheTimeout}
                onChange={(
                  event: React.FormEvent<FormControl & FormControlProps>,
                ) => {
                  const targetValue =
                    (event.currentTarget?.value as string) ?? '';
                  setCacheTimeout(targetValue.replace(/[^0-9]/, ''));
                }}
              />
              <p className="help-block">
                {t(
                  'Duration (in seconds) of the caching timeout for this chart. Note this defaults to the datasource/table timeout if undefined.',
                )}
              </p>
            </FormGroup>
            <h3 style={{ marginTop: '1em' }}>{t('Access')}</h3>
            <FormGroup>
              <FormLabel htmlFor="owners">{t('Owners')}</FormLabel>
              <AsyncSelect
                isMulti
                name="owners"
                value={owners || []}
                loadOptions={loadOptions}
                defaultOptions // load options on render
                cacheOptions
                onChange={setOwners}
                disabled={!owners}
                filterOption={null} // options are filtered at the api
              />
              <p className="help-block">
                {t(
                  'A list of users who can alter the chart. Searchable by name or username.',
                )}
              </p>
            </FormGroup>
          </Col>
        </Row>
      </Modal.Body>
      <Modal.Footer>
        <Button type="button" buttonSize="sm" onClick={onHide} cta>
          {t('Cancel')}
        </Button>
        <Button
          type="submit"
          buttonSize="sm"
          buttonStyle="primary"
          disabled={!owners || submitting || !name}
          cta
        >
          {t('Save')}
        </Button>
        <Dialog ref={errorDialog} />
      </Modal.Footer>
    </form>
  );
}

export default function PropertiesModalWrapper({
  show,
  onHide,
  animation,
  slice,
  onSave,
}: WrapperProps) {
  // The wrapper is a separate component so that hooks only run when the modal opens
  return (
    <Modal show={show} onHide={onHide} animation={animation} bsSize="large">
      <PropertiesModal slice={slice} onHide={onHide} onSave={onSave} />
    </Modal>
  );
}
