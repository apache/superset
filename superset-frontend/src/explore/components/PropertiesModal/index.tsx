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
  AsyncSelect,
  Modal,
  Collapse,
  CollapseLabelInModal,
  type SelectValue,
} from '@superset-ui/core/components';
import rison from 'rison';
import {
  t,
  SupersetClient,
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
import {
  StandardModal,
  ModalFormField,
  useModalValidation,
} from 'src/components/Modal';
import { useUpdateChart, type ChartUpdatePayload } from '@superset-ui/core/api';

export type PropertiesModalProps = {
  slice: Slice;
  show: boolean;
  onHide: () => void;
  onSave: (chart: Chart) => void;
  permissionsError?: string;
  existingOwners?: SelectValue;
  addSuccessToast: (msg: string) => void;
};

function PropertiesModal({
  slice,
  onHide,
  onSave,
  show,
  addSuccessToast,
}: PropertiesModalProps) {
  const [submitting, setSubmitting] = useState(false);

  // 🚀 ORVAL POC: TanStack Query mutation hook
  const updateChartMutation = useUpdateChart();
  // values of form inputs
  const [name, setName] = useState(slice.slice_name || '');
  const [description, setDescription] = useState(slice.description || '');
  const [cacheTimeout, setCacheTimeout] = useState(
    slice.cache_timeout != null ? String(slice.cache_timeout) : '',
  );
  const [certifiedBy, setCertifiedBy] = useState(slice.certified_by || '');
  const [certificationDetails, setCertificationDetails] = useState(
    slice.certified_by && slice.certification_details
      ? slice.certification_details
      : '',
  );
  const [selectedOwners, setSelectedOwners] = useState<SelectValue | null>(
    null,
  );
  const [tags, setTags] = useState<TagType[]>([]);

  // Validation setup
  const modalSections = useMemo(
    () => [
      {
        key: 'general',
        name: t('General settings'),
        validator: () => {
          const errors = [];
          if (!name || name.trim().length === 0) {
            errors.push(t('Chart name is required'));
          }
          return errors;
        },
      },
      {
        key: 'configuration',
        name: t('Configuration'),
        validator: () => {
          const errors = [];
          if (cacheTimeout && Number.isNaN(Number(cacheTimeout))) {
            errors.push(t('Cache timeout must be a number'));
          }
          return errors;
        },
      },
      {
        key: 'advanced',
        name: t('Advanced'),
        validator: () => [],
      },
    ],
    [name, cacheTimeout],
  );

  const {
    validationStatus,
    validateAll,
    validateSection,
    errorTooltip,
    hasErrors,
  } = useModalValidation({
    sections: modalSections,
  });

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

  // 🚀 ORVAL: Replace SupersetClient.put with TanStack Query mutation
  const onSubmit = async () => {
    if (!validateAll()) return;

    setSubmitting(true);
    const payload: ChartUpdatePayload = {
      slice_name: name || undefined,
      description: description || undefined,
      cache_timeout: cacheTimeout ? Number(cacheTimeout) : undefined,
    };

    try {
      // Type-safe mutation with automatic cache management!
      const updatedChart = await updateChartMutation.mutateAsync({
        pk: slice.slice_id,
        data: payload,
      });

      onSave(updatedChart as any); // POC: Type conversion for demo
      addSuccessToast(t('Chart properties updated'));
      onHide();
    } catch (error) {
      console.error('Chart update failed:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Update failed';
      showError({ error: errorMessage });
    } finally {
      setSubmitting(false);
    }
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

  // Validate general section when name changes
  useEffect(() => {
    validateSection('general');
  }, [name, validateSection]);

  // Validate configuration section when cache timeout changes
  useEffect(() => {
    validateSection('configuration');
  }, [cacheTimeout, validateSection]);

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
    <StandardModal
      show={show}
      onHide={onHide}
      onSave={onSubmit}
      title={t('Chart properties')}
      isEditMode
      saveDisabled={
        submitting || !name || slice.is_managed_externally || hasErrors
      }
      errorTooltip={
        slice.is_managed_externally
          ? t(
              "This chart is managed externally, and can't be edited in Superset",
            )
          : errorTooltip
      }
      wrapProps={{ 'data-test': 'properties-edit-modal' }}
    >
      <Collapse
        expandIconPosition="end"
        defaultActiveKey="general"
        accordion
        modalMode
        items={[
          {
            key: 'general',
            label: (
              <CollapseLabelInModal
                title={t('General settings')}
                subtitle={t('Basic information about the chart')}
                validateCheckStatus={!validationStatus.general?.hasErrors}
                testId="general-section"
              />
            ),
            children: (
              <>
                <ModalFormField
                  label={t('Name')}
                  required
                  error={
                    validationStatus.general?.hasErrors && !name
                      ? t('Chart name is required')
                      : undefined
                  }
                >
                  <Input
                    aria-label={t('Name')}
                    data-test="properties-modal-name-input"
                    type="text"
                    value={name}
                    onChange={(event: ChangeEvent<HTMLInputElement>) =>
                      setName(event.target.value ?? '')
                    }
                  />
                </ModalFormField>
                <ModalFormField
                  label={t('Description')}
                  helperText={t(
                    'The description can be displayed as widget headers in the dashboard view. Supports markdown.',
                  )}
                >
                  <Input.TextArea
                    rows={3}
                    value={description}
                    onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
                      setDescription(event.target.value ?? '')
                    }
                  />
                </ModalFormField>
                <ModalFormField
                  label={t('Owners')}
                  helperText={t(
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
                </ModalFormField>
                {isFeatureEnabled(FeatureFlag.TaggingSystem) && (
                  <ModalFormField
                    label={t('Tags')}
                    helperText={t(
                      'A list of tags that have been applied to this chart.',
                    )}
                    bottomSpacing={false}
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
                  </ModalFormField>
                )}
              </>
            ),
          },
          {
            key: 'configuration',
            label: (
              <CollapseLabelInModal
                title={t('Configuration')}
                subtitle={t('Configure caching and performance settings')}
                validateCheckStatus={!validationStatus.configuration?.hasErrors}
                testId="configuration-section"
              />
            ),
            children: (
              <ModalFormField
                label={t('Cache timeout')}
                helperText={t(
                  "Duration (in seconds) of the caching timeout for this chart. Set to -1 to bypass the cache. Note this defaults to the dataset's timeout if undefined.",
                )}
                error={
                  validationStatus.configuration?.hasErrors &&
                  cacheTimeout &&
                  Number.isNaN(Number(cacheTimeout))
                    ? t('Cache timeout must be a number')
                    : undefined
                }
                bottomSpacing={false}
              >
                <Input
                  aria-label="Cache timeout"
                  value={cacheTimeout}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    setCacheTimeout(event.target.value ?? '')
                  }
                />
              </ModalFormField>
            ),
          },
          {
            key: 'advanced',
            label: (
              <CollapseLabelInModal
                title={t('Advanced')}
                subtitle={t('Certification and additional settings')}
                validateCheckStatus={!validationStatus.advanced?.hasErrors}
                testId="advanced-section"
              />
            ),
            children: (
              <>
                <ModalFormField
                  label={t('Certified by')}
                  helperText={t(
                    'Person or group that has certified this chart.',
                  )}
                >
                  <Input
                    aria-label={t('Certified by')}
                    value={certifiedBy}
                    onChange={(event: ChangeEvent<HTMLInputElement>) =>
                      setCertifiedBy(event.target.value ?? '')
                    }
                  />
                </ModalFormField>
                <ModalFormField
                  label={t('Certification details')}
                  helperText={t(
                    'Any additional detail to show in the certification tooltip.',
                  )}
                  bottomSpacing={false}
                >
                  <Input
                    aria-label={t('Certification details')}
                    value={certificationDetails}
                    onChange={(event: ChangeEvent<HTMLInputElement>) =>
                      setCertificationDetails(event.target.value ?? '')
                    }
                  />
                </ModalFormField>
              </>
            ),
          },
        ]}
      />
    </StandardModal>
  );
}

export default withToasts(PropertiesModal);
