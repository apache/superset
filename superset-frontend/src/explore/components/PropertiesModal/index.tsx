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
import React, { useMemo, useState, useCallback, useEffect } from 'react';
import Modal from 'src/components/Modal';
import { Row, Col, Input, TextArea } from 'src/common/components';
import Button from 'src/components/Button';
import { Select } from 'src/components';
import { SelectValue } from 'antd/lib/select';
import rison from 'rison';
import { t, SupersetClient } from '@superset-ui/core';
import Chart, { Slice } from 'src/types/Chart';
import { Form, FormItem } from 'src/components/Form';
import { getClientErrorObject } from 'src/utils/getClientErrorObject';

type PropertiesModalProps = {
  slice: Slice;
  show: boolean;
  onHide: () => void;
  onSave: (chart: Chart) => void;
  permissionsError?: string;
  existingOwners?: SelectValue;
};

export default function PropertiesModal({
  slice,
  onHide,
  onSave,
  show,
}: PropertiesModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [selectedOwners, setSelectedOwners] = useState<SelectValue | null>(
    null,
  );
  // values of form inputs
  const [name, setName] = useState(slice.slice_name || '');
  const [description, setDescription] = useState(slice.description || '');
  const [cacheTimeout, setCacheTimeout] = useState(
    slice.cache_timeout != null ? slice.cache_timeout : '',
  );

  function showError({ error, statusText, message }: any) {
    let errorText = error || statusText || t('An error has occurred');
    if (message === 'Forbidden') {
      errorText = t('You do not have permission to edit this chart');
    }
    Modal.error({
      title: 'Error',
      content: errorText,
      okButtonProps: { danger: true, className: 'btn-danger' },
    });
  }

  const fetchChartOwners = useCallback(
    async function fetchChartOwners() {
      try {
        const response = await SupersetClient.get({
          endpoint: `/api/v1/chart/${slice.slice_id}`,
        });
        const chart = response.json.result;
        setSelectedOwners(
          chart.owners.map((owner: any) => ({
            value: owner.id,
            label: `${owner.first_name} ${owner.last_name}`,
          })),
        );
      } catch (response) {
        const clientError = await getClientErrorObject(response);
        showError(clientError);
      }
    },
    [slice.slice_id],
  );

  const loadOptions = useMemo(
    () => (input = '', page: number, pageSize: number) => {
      const query = rison.encode({ filter: input, page, page_size: pageSize });
      return SupersetClient.get({
        endpoint: `/api/v1/chart/related/owners?q=${query}`,
      }).then(response => ({
        data: response.json.result.map(
          (item: { value: number; text: string }) => ({
            value: item.value,
            label: item.text,
          }),
        ),
        totalCount: response.json.count,
      }));
    },
    [],
  );

  const onSubmit = async (event: React.FormEvent) => {
    event.stopPropagation();
    event.preventDefault();
    setSubmitting(true);
    const payload: { [key: string]: any } = {
      slice_name: name || null,
      description: description || null,
      cache_timeout: cacheTimeout || null,
    };
    if (selectedOwners) {
      payload.owners = (selectedOwners as {
        value: number;
        label: string;
      }[]).map(o => o.value);
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

  const ownersLabel = t('Owners');

  // get the owners of this slice
  useEffect(() => {
    fetchChartOwners();
  }, [fetchChartOwners]);

  // update name after it's changed in another modal
  useEffect(() => {
    setName(slice.slice_name || '');
  }, [slice.slice_name]);

  return (
    <Modal
      show={show}
      onHide={onHide}
      title="Edit Chart Properties"
      footer={
        <>
          <Button
            data-test="properties-modal-cancel-button"
            htmlType="button"
            buttonSize="small"
            onClick={onHide}
            cta
          >
            {t('Cancel')}
          </Button>
          <Button
            data-test="properties-modal-save-button"
            htmlType="button"
            buttonSize="small"
            buttonStyle="primary"
            // @ts-ignore
            onClick={onSubmit}
            disabled={submitting || !name}
            cta
          >
            {t('Save')}
          </Button>
        </>
      }
      responsive
      wrapProps={{ 'data-test': 'properties-edit-modal' }}
    >
      <Form onFinish={onSubmit} layout="vertical">
        <Row gutter={16}>
          <Col xs={24} md={12}>
            <h3>{t('Basic information')}</h3>
            <FormItem label={t('Name')} required>
              <Input
                aria-label={t('Name')}
                name="name"
                data-test="properties-modal-name-input"
                type="text"
                value={name}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                  setName(event.target.value ?? '')
                }
              />
            </FormItem>
            <FormItem label={t('Description')}>
              <TextArea
                rows={3}
                name="description"
                value={description}
                onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) =>
                  setDescription(event.target.value ?? '')
                }
                style={{ maxWidth: '100%' }}
              />
              <p className="help-block">
                {t(
                  'The description can be displayed as widget headers in the dashboard view. Supports markdown.',
                )}
              </p>
            </FormItem>
          </Col>
          <Col xs={24} md={12}>
            <h3>{t('Configuration')}</h3>
            <FormItem label={t('Cache timeout')}>
              <Input
                name="cacheTimeout"
                type="text"
                value={cacheTimeout}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                  const targetValue = event.target.value ?? '';
                  setCacheTimeout(targetValue.replace(/[^0-9]/, ''));
                }}
              />
              <p className="help-block">
                {t(
                  "Duration (in seconds) of the caching timeout for this chart. Note this defaults to the dataset's timeout if undefined.",
                )}
              </p>
            </FormItem>
            <h3 style={{ marginTop: '1em' }}>{t('Access')}</h3>
            <FormItem label={ownersLabel}>
              <Select
                ariaLabel={ownersLabel}
                mode="multiple"
                name="owners"
                value={selectedOwners || []}
                onChange={setSelectedOwners}
                options={loadOptions}
                disabled={!selectedOwners}
                allowClear
              />
              <p className="help-block">
                {t(
                  'A list of users who can alter the chart. Searchable by name or username.',
                )}
              </p>
            </FormItem>
          </Col>
        </Row>
      </Form>
    </Modal>
  );
}
