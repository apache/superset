// DODO was here
import { ChangeEvent, useMemo, useState, useCallback, useEffect } from 'react';
import { useSelector } from 'react-redux'; // DODO added 44211792

import Modal from 'src/components/Modal';
import { Input, TextArea } from 'src/components/Input';
import Button from 'src/components/Button';
import { AsyncSelect, Row, Col, AntdForm } from 'src/components';
import { SelectValue } from 'antd/lib/select';
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
import { loadTags } from 'src/components/Tags/utils';
import { fetchTags, OBJECT_TYPES } from 'src/features/tags/tags';
import TagType from 'src/types/TagType';
import getOwnerName from 'src/utils/getOwnerName'; // DODO added 44211759
import { getUserInfo } from 'src/DodoExtensions/onBoarding/model/selectors/getUserInfo'; // DODO added 44211792

export type PropertiesModalProps = {
  slice: Slice;
  show: boolean;
  onHide: () => void;
  onSave: (chart: Chart) => void;
  permissionsError?: string;
  existingOwners?: SelectValue;
  addSuccessToast: (msg: string) => void;
};

// DODO added 44211759
interface IExtra {
  active: boolean;
  email: string;
  country_name: string;
}

const FormItem = AntdForm.Item;

const StyledFormItem = styled(AntdForm.Item)`
  margin-bottom: 0;
`;

const StyledHelpBlock = styled.span`
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
  const [form] = AntdForm.useForm();
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

  const fetchChartOwners = useCallback(
    async function fetchChartOwners() {
      try {
        const response = await SupersetClient.get({
          endpoint: `/api/v1/chart/${slice.slice_id}`,
        });
        const chart = response.json.result;
        setSelectedOwners(
          chart?.owners?.map((owner: any) => ({
            value: owner.id,
            label: getOwnerName(owner), // DODO changed 44211759
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
          data: response.json.result
            .filter((item: { extra: Partial<IExtra> }) => item.extra.active)
            .map(
              (item: {
                value: number;
                text: string;
                extra: Partial<IExtra>; // DODO added 44211759
              }) => {
                // DODO added start 44211759
                const { country_name, email } = item.extra;
                let label = item.text;
                label += ` (${country_name || 'no country'})`;
                if (email) label += ` ${email}`;
                // DODO added stop 44211759
                return {
                  value: item.value,
                  label,
                };
              },
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
    if (isFeatureEnabled(FeatureFlag.TaggingSystem)) {
      payload.tags = tags.map(tag => tag.id);
    }

    try {
      const res = await SupersetClient.put({
        endpoint: `/api/v1/chart/${slice.slice_id}`,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      // update the redux state
      const updatedChart = {
        ...payload,
        ...res.json.result,
        tags,
        id: slice.slice_id,
        owners: selectedOwners,
      };
      onSave(updatedChart);
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
    fetchChartOwners();
  }, [fetchChartOwners]);

  // update name after it's changed in another modal
  useEffect(() => {
    setName(slice.slice_name || '');
  }, [slice.slice_name]);

  useEffect(() => {
    if (!isFeatureEnabled(FeatureFlag.TaggingSystem)) return;
    try {
      fetchTags(
        {
          objectType: OBJECT_TYPES.CHART,
          objectId: slice.slice_id,
          includeTypes: false,
        },
        (tags: TagType[]) => setTags(tags),
        error => {
          showError(error);
        },
      );
    } catch (error) {
      showError(error);
    }
  }, [slice.slice_id]);

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

  const user = useSelector(getUserInfo); // DODO added 44211792

  return (
    <Modal
      show={show}
      onHide={onHide}
      title={t('Edit Chart Properties')}
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
      <AntdForm
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
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
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
                <Input aria-label={t('Certified by')} />
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
                <Input aria-label={t('Certification details')} />
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
              <StyledFormItem label={t('Cache timeout')} name="cache_timeout">
                <Input aria-label="Cache timeout" />
              </StyledFormItem>
              <StyledHelpBlock className="help-block">
                {t(
                  "Duration (in seconds) of the caching timeout for this chart. Set to -1 to bypass the cache. Note this defaults to the dataset's timeout if undefined.",
                )}
              </StyledHelpBlock>
            </FormItem>
            <h3 style={{ marginTop: '1em' }}>{t('Access')}</h3>
            <FormItem label={ownersLabel}>
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
              <StyledHelpBlock className="help-block">
                {t(
                  'A list of users who can alter the chart. Searchable by name or username.',
                )}
              </StyledHelpBlock>
            </FormItem>
            {isFeatureEnabled(FeatureFlag.TaggingSystem) && (
              <h3 css={{ marginTop: '1em' }}>{t('Tags')}</h3>
            )}
            {isFeatureEnabled(FeatureFlag.TaggingSystem) && (
              <FormItem>
                <AsyncSelect
                  ariaLabel="Tags"
                  mode="multiple"
                  value={tagsAsSelectValues}
                  options={loadTags}
                  onChange={handleChangeTags}
                  onClear={handleClearTags}
                  allowClear
                  disabled={!user?.roles?.Admin} // DODO added 44211792
                />
                <StyledHelpBlock className="help-block">
                  {t('A list of tags that have been applied to this chart.')}
                </StyledHelpBlock>
              </FormItem>
            )}
          </Col>
        </Row>
      </AntdForm>
    </Modal>
  );
}

export default withToasts(PropertiesModal);
