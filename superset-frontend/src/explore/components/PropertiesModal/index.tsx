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
import { Form, Row, Col, Input, TextArea } from 'src/common/components';
import Button from 'src/components/Button';
import { Select } from 'src/components';
import { SelectValue } from 'antd/lib/select';
import rison from 'rison';
import { t, SupersetClient, styled } from '@superset-ui/core';
import Chart, { Slice } from 'src/types/Chart';
import { getClientErrorObject } from 'src/utils/getClientErrorObject';

type PropertiesModalProps = {
  slice: Slice;
  show: boolean;
  onHide: () => void;
  onSave: (chart: Chart) => void;
  permissionsError?: string;
  existingOwners?: SelectValue;
};

const FormItem = Form.Item;

const StyledFormItem = styled(Form.Item)`
  margin-bottom: 0;
`;

const StyledHelpBlock = styled.span`
  margin-bottom: 0;
`;

export default function PropertiesModal({
  slice,
  onHide,
  onSave,
  show,
}: PropertiesModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();
  // values of form inputs
  const [name, setName] = useState(slice.slice_name || '');
  const [selectedOwners, setSelectedOwners] = useState<SelectValue | null>(
    null,
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
    () =>
      (input = '', page: number, pageSize: number) => {
        const query = rison.encode({
          filter: input,
          page,
          page_size: pageSize,
        });
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

  const onSubmit = async (values: {
    certified_by?: string;
    certification_details?: string;
    description?: string;
    cache_timeout?: number;
  }) => {
    setSubmitting(true);
    const {
      certified_by: certifiedBy,
      certification_details: certificationDetails,
      description,
      cache_timeout: cacheTimeout,
    } = values;
    const payload: { [key: string]: any } = {
      slice_name: name || null,
      description: description || null,
      cache_timeout: cacheTimeout || null,
      certified_by: certifiedBy || null,
      certification_details:
        certifiedBy && certificationDetails ? certificationDetails : null,
    };
    if (selectedOwners) {
      payload.owners = (
        selectedOwners as {
          value: number;
          label: string;
        }[]
      ).map(o => o.value);
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
            htmlType="submit"
            buttonSize="small"
            buttonStyle="primary"
            onClick={form.submit}
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
      <Form
        form={form}
        onFinish={onSubmit}
        layout="vertical"
        initialValues={{
          name: slice.slice_name || '',
          description: slice.description || '',
          cache_timeout: slice.cache_timeout != null ? slice.cache_timeout : '',
          certified_by: slice.certified_by || '',
          certification_details:
            slice.certified_by && slice.certification_details
              ? slice.certification_details
              : '',
        }}
      >
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
            <FormItem>
              <StyledFormItem label={t('Description')} name="description">
                <TextArea rows={3} style={{ maxWidth: '100%' }} />
              </StyledFormItem>
              <StyledHelpBlock className="help-block">
                {t(
                  'The description can be displayed as widget headers in the dashboard view. Supports markdown.',
                )}
              </StyledHelpBlock>
            </FormItem>
            <h3>{t('Certification')}</h3>
            <FormItem>
              <StyledFormItem label={t('Certified by')} name="certified_by">
                <Input />
              </StyledFormItem>
              <StyledHelpBlock className="help-block">
                {t('Person or group that has certified this chart.')}
              </StyledHelpBlock>
            </FormItem>
            <FormItem>
              <StyledFormItem
                label={t('Certification details')}
                name="certification_details"
              >
                <Input />
              </StyledFormItem>
              <StyledHelpBlock className="help-block">
                {t(
                  'Any additional detail to show in the certification tooltip.',
                )}
              </StyledHelpBlock>
            </FormItem>
          </Col>
          <Col xs={24} md={12}>
            <h3>{t('Configuration')}</h3>
            <FormItem>
              <StyledFormItem label={t('Cache timeout')} name="cacheTimeout">
                <Input />
              </StyledFormItem>
              <StyledHelpBlock className="help-block">
                {t(
                  "Duration (in seconds) of the caching timeout for this chart. Note this defaults to the dataset's timeout if undefined.",
                )}
              </StyledHelpBlock>
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
              <StyledHelpBlock className="help-block">
                {t(
                  'A list of users who can alter the chart. Searchable by name or username.',
                )}
              </StyledHelpBlock>
            </FormItem>
          </Col>
        </Row>
      </Form>
    </Modal>
  );
}
