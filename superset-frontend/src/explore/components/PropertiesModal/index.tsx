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
  Collapse,
  CollapseLabelInModal,
} from '@superset-ui/core/components';
import rison from 'rison';
import { t } from '@apache-superset/core/translation';
import {
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
import SubjectPicker, {
  mapSubjectsToPickerValues,
  type SubjectPickerValue,
} from 'src/features/subjects/SubjectPicker';

export type PropertiesModalProps = {
  slice: Slice;
  show: boolean;
  onHide: () => void;
  onSave: (chart: Chart) => void;
  permissionsError?: string;
  addSuccessToast: (msg: string) => void;
  addDangerToast: (msg: string) => void;
};

function PropertiesModal({
  slice,
  onHide,
  onSave,
  show,
  addSuccessToast,
  addDangerToast,
}: PropertiesModalProps) {
  const [submitting, setSubmitting] = useState(false);
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
  const [selectedEditors, setSelectedEditors] = useState<
    SubjectPickerValue[] | null
  >(null);
  const [selectedViewers, setSelectedViewers] = useState<
    SubjectPickerValue[] | null
  >(null);
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

  const showError = useCallback(
    ({ error, statusText, message }: any) => {
      let errorText = error || statusText || t('An error has occurred');
      if (message === 'Forbidden') {
        errorText = t('You do not have permission to edit this chart');
      }

      addDangerToast(errorText);
    },
    [addDangerToast],
  );

  const fetchChartProperties = useCallback(
    async function fetchChartProperties() {
      const selectColumns = [
        'tags.id',
        'tags.name',
        'tags.type',
        'editors.id',
        'editors.label',
        'editors.secondary_label',
        'editors.type',
        ...(isFeatureEnabled(FeatureFlag.EnableViewers)
          ? [
              'viewers.id',
              'viewers.label',
              'viewers.secondary_label',
              'viewers.type',
            ]
          : []),
      ];
      const queryParams = rison.encode({
        select_columns: selectColumns,
      });
      try {
        const response = await SupersetClient.get({
          endpoint: `/api/v1/chart/${slice.slice_id}?q=${queryParams}`,
        });
        const chart = response.json.result;
        if (isFeatureEnabled(FeatureFlag.TaggingSystem)) {
          const customTags = chart.tags?.filter(
            (tag: TagType) => tag.type === TagTypeEnum.Custom,
          );
          setTags(customTags);
        }
        setSelectedEditors(mapSubjectsToPickerValues(chart?.editors ?? []));
        if (isFeatureEnabled(FeatureFlag.EnableViewers)) {
          setSelectedViewers(mapSubjectsToPickerValues(chart?.viewers ?? []));
        }
      } catch (response) {
        const clientError = await getClientErrorObject(response);
        showError(clientError);
      }
    },
    [showError, slice.slice_id],
  );

  const onSubmit = async () => {
    // Run validation first
    if (!validateAll()) {
      return;
    }

    setSubmitting(true);
    const payload: { [key: string]: any } = {
      slice_name: name || null,
      description: description || null,
      cache_timeout: cacheTimeout ? Number(cacheTimeout) : null,
      certified_by: certifiedBy || null,
      certification_details:
        certifiedBy && certificationDetails ? certificationDetails : null,
    };
    if (isFeatureEnabled(FeatureFlag.TaggingSystem)) {
      payload.tags = tags.map(tag => tag.id);
    }
    if (selectedEditors) {
      payload.editors = selectedEditors.map(e => e.value);
    }
    if (selectedViewers) {
      payload.viewers = selectedViewers.map(v => v.value);
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

  // get the editors of this slice
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
                {isFeatureEnabled(FeatureFlag.TaggingSystem) && (
                  <ModalFormField
                    label={t('Tags')}
                    helperText={t(
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
                  </ModalFormField>
                )}
                <ModalFormField
                  label={t('Editors')}
                  helperText={t(
                    'A list of subjects who can alter the chart. Searchable by name.',
                  )}
                  bottomSpacing={!isFeatureEnabled(FeatureFlag.EnableViewers)}
                >
                  <SubjectPicker
                    relatedUrl="/api/v1/chart/related/editors"
                    ariaLabel={t('Editors')}
                    value={selectedEditors || []}
                    onChange={setSelectedEditors}
                    disabled={!selectedEditors}
                    allowClear
                  />
                </ModalFormField>
                {isFeatureEnabled(FeatureFlag.EnableViewers) && (
                  <ModalFormField
                    label={t('Viewers')}
                    helperText={t(
                      'A list of subjects who can view the chart. Searchable by name.',
                    )}
                    bottomSpacing={false}
                  >
                    <SubjectPicker
                      relatedUrl="/api/v1/chart/related/viewers"
                      ariaLabel={t('Viewers')}
                      value={selectedViewers || []}
                      onChange={setSelectedViewers}
                      disabled={!selectedViewers}
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
                  aria-label={t('Cache timeout')}
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
