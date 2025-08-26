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
import { ChangeEvent, useMemo, useState, useCallback, useEffect } from 'react';

import {
  Input,
  Modal,
  AsyncSelect,
  Button,
  Form,
  Row,
  Col,
  FormItem,
  Typography,
  type SelectValue,
} from '@superset-ui/core/components';
import rison from 'rison';
import {
  t,
  SupersetClient,
  styled,
  isFeatureEnabled,
  FeatureFlag,
  getClientErrorObject,
  ensureIsArray,
} from '@superset-ui/core';
import Chart, { Slice } from 'src/types/Chart';
import withToasts from 'src/components/MessageToasts/withToasts';
import { type TagType } from 'src/components';
import { TagTypeEnum } from 'src/components/Tag/TagType';
import { loadTags } from 'src/components/Tag/utils';
import { ModalTitleWithIcon } from 'src/components/ModalTitleWithIcon';

export type PropertiesModalProps = {
  slice: Slice;
  show: boolean;
  onHide: () => void;
  onSave: (chart: Chart) => void;
  permissionsError?: string;
  existingOwners?: SelectValue;
  addSuccessToast: (msg: string) => void;
};

const StyledFormItem = styled(FormItem)`
  margin-bottom: 0;
`;

function PropertiesModal({
  slice,
  onHide,
  onSave,
  show,
  addSuccessToast,
}: PropertiesModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();
  // values of form inputs
  const [name, setName] = useState(slice.slice_name || '');
  const [selectedOwners, setSelectedOwners] = useState<SelectValue | null>(
    null,
  );

  const [tags, setTags] = useState<TagType[]>([]);

  const tagsAsSelectValues = useMemo(() => {
    const selectTags = tags.map((tag: { id: number; name: string }) => ({
      value: tag.id,
      label: tag.name,
    }));
    return selectTags;
  }, [tags.length]);

  function showError({ error, statusText, message }: any) {
    let errorText = error || statusText || t('An error has occurred');
    if (message === 'Forbidden') {
      errorText = t('You do not have permission to edit this chart');
    }
    Modal.error({
      title: t('Error'),
      content: errorText,
      okButtonProps: { danger: true, className: 'btn-danger' },
    });
  }

  const fetchChartProperties = useCallback(
    async function fetchChartProperties() {
      const queryParams = rison.encode({
        select_columns: [
          'owners.id',
          'owners.first_name',
          'owners.last_name',
          'tags.id',
          'tags.name',
          'tags.type',
        ],
      });
      try {
        const response = await SupersetClient.get({
          endpoint: `/api/v1/chart/${slice.slice_id}?q=${queryParams}`,
        });
        const chart = response.json.result;
        setSelectedOwners(
          chart?.owners?.map((owner: any) => ({
            value: owner.id,
            label: `${owner.first_name} ${owner.last_name}`,
          })),
        );
        if (isFeatureEnabled(FeatureFlag.TaggingSystem)) {
          const customTags = chart.tags?.filter(
            (tag: TagType) => tag.type === TagTypeEnum.Custom,
          );
          setTags(customTags);
        }
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
          data: response.json.result
            .filter((item: { extra: { active: boolean } }) => item.extra.active)
            .map((item: { value: number; text: string }) => ({
              value: item.value,
              label: item.text,
            })),
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
    if (isFeatureEnabled(FeatureFlag.TaggingSystem)) {
      payload.tags = tags.map(tag => tag.id);
    }

    try {
      const chartEndpoint = `/api/v1/chart/${slice.slice_id}`;
      let res = await SupersetClient.put({
        endpoint: chartEndpoint,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      res = await SupersetClient.get({
        endpoint: chartEndpoint,
      });
      onSave(res.json.result);
      addSuccessToast(t('Chart properties updated'));
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
    fetchChartProperties();
  }, [slice.slice_id]);

  // update name after it's changed in another modal
  useEffect(() => {
    setName(slice.slice_name || '');
  }, [slice.slice_name]);

  const handleChangeTags = (tags: { label: string; value: number }[]) => {
    const parsedTags: TagType[] = ensureIsArray(tags).map(r => ({
      id: r.value,
      name: r.label,
    }));
    setTags(parsedTags);
  };

  const handleClearTags = () => {
    setTags([]);
  };

  return (
    <Modal
      show={show}
      onHide={onHide}
      name={t('Edit Chart Properties')}
      title={
        <ModalTitleWithIcon
          isEditMode
          title={t('Edit Chart Properties')}
          data-test="edit-alt"
        />
      }
      footer={
        <>
          <Button
            data-test="properties-modal-cancel-button"
            htmlType="button"
            buttonSize="small"
            onClick={onHide}
            buttonStyle="secondary"
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
            disabled={submitting || !name || slice.is_managed_externally}
            tooltip={
              slice.is_managed_externally
                ? t(
                    "This chart is managed externally, and can't be edited in Superset",
                  )
                : ''
            }
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
            <Typography.Title level={3}>
              {t('Basic information')}
            </Typography.Title>
            <FormItem label={t('Name')} required>
              <Input
                aria-label={t('Name')}
                name="name"
                data-test="properties-modal-name-input"
                type="text"
                value={name}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setName(event.target.value ?? '')
                }
              />
            </FormItem>
            <FormItem
              extra={t(
                'The description can be displayed as widget headers in the dashboard view. Supports markdown.',
              )}
            >
              <StyledFormItem label={t('Description')} name="description">
                <Input.TextArea rows={3} style={{ maxWidth: '100%' }} />
              </StyledFormItem>
            </FormItem>
            <Typography.Title level={3}>{t('Certification')}</Typography.Title>
            <FormItem
              extra={t('Person or group that has certified this chart.')}
            >
              <StyledFormItem label={t('Certified by')} name="certified_by">
                <Input aria-label={t('Certified by')} />
              </StyledFormItem>
            </FormItem>
            <FormItem
              extra={t(
                'Any additional detail to show in the certification tooltip.',
              )}
            >
              <StyledFormItem
                label={t('Certification details')}
                name="certification_details"
              >
                <Input aria-label={t('Certification details')} />
              </StyledFormItem>
            </FormItem>
          </Col>
          <Col xs={24} md={12}>
            <Typography.Title level={3}>{t('Configuration')}</Typography.Title>
            <FormItem
              extra={t(
                "Duration (in seconds) of the caching timeout for this chart. Set to -1 to bypass the cache. Note this defaults to the dataset's timeout if undefined.",
              )}
            >
              <StyledFormItem label={t('Cache timeout')} name="cache_timeout">
                <Input aria-label="Cache timeout" />
              </StyledFormItem>
            </FormItem>
            <Typography.Title level={3} style={{ marginTop: '1em' }}>
              {t('Access')}
            </Typography.Title>
            <FormItem
              label={ownersLabel}
              extra={t(
                'A list of users who can alter the chart. Searchable by name or username.',
              )}
            >
              <AsyncSelect
                ariaLabel={ownersLabel}
                mode="multiple"
                name="owners"
                value={selectedOwners || []}
                onChange={setSelectedOwners}
                options={loadOptions}
                disabled={!selectedOwners}
                allowClear
              />
            </FormItem>
            {isFeatureEnabled(FeatureFlag.TaggingSystem) && (
              <Typography.Title level={3} css={{ marginTop: '1em' }}>
                {t('Tags')}
              </Typography.Title>
            )}
            {isFeatureEnabled(FeatureFlag.TaggingSystem) && (
              <FormItem
                extra={t(
                  'A list of tags that have been applied to this chart.',
                )}
              >
                <AsyncSelect
                  ariaLabel="Tags"
                  mode="multiple"
                  value={tagsAsSelectValues}
                  options={loadTags}
                  onChange={handleChangeTags}
                  onClear={handleClearTags}
                  allowClear
                />
              </FormItem>
            )}
          </Col>
        </Row>
      </Form>
    </Modal>
  );
}

export default withToasts(PropertiesModal);
