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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { omit } from 'lodash';
import jsonStringify from 'json-stringify-pretty-compact';
import {
  Form,
  Modal,
  Collapse,
  CollapseLabelInModal,
  JsonEditor,
} from '@superset-ui/core/components';
import { useJsonValidation } from '@superset-ui/core/components/AsyncAceEditor';
import { type TagType } from 'src/components';
import rison from 'rison';
import {
  ensureIsArray,
  isFeatureEnabled,
  FeatureFlag,
  getCategoricalSchemeRegistry,
  SupersetClient,
  t,
  getClientErrorObject,
} from '@superset-ui/core';

import withToasts from 'src/components/MessageToasts/withToasts';
import { fetchTags, OBJECT_TYPES } from 'src/features/tags/tags';
import {
  applyColors,
  getColorNamespace,
  getFreshLabelsColorMapEntries,
} from 'src/utils/colorScheme';
import { useDispatch } from 'react-redux';
import {
  setColorScheme,
  setDashboardMetadata,
} from 'src/dashboard/actions/dashboardState';
import { areObjectsEqual } from 'src/reduxUtils';
import { StandardModal, useModalValidation } from 'src/components/Modal';
import {
  BasicInfoSection,
  AccessSection,
  StylingSection,
  RefreshSection,
  CertificationSection,
  AdvancedSection,
} from './sections';

type PropertiesModalProps = {
  dashboardId: number;
  dashboardTitle?: string;
  dashboardInfo?: Record<string, any>;
  show?: boolean;
  onHide?: () => void;
  colorScheme?: string;
  onSubmit?: (params: Record<string, any>) => void;
  addSuccessToast: (message: string) => void;
  addDangerToast: (message: string) => void;
  onlyApply?: boolean;
};

type Roles = { id: number; name: string }[];
type Owners = {
  id: number;
  full_name?: string;
  first_name?: string;
  last_name?: string;
}[];
type DashboardInfo = {
  id: number;
  title: string;
  slug: string;
  certifiedBy: string;
  certificationDetails: string;
  isManagedExternally: boolean;
  metadata: Record<string, any>;
  common?: {
    conf?: {
      SUPERSET_DASHBOARD_PERIODICAL_REFRESH_LIMIT?: number;
    };
  };
};

const PropertiesModal = ({
  addSuccessToast,
  addDangerToast,
  colorScheme: currentColorScheme,
  dashboardId,
  dashboardInfo: currentDashboardInfo,
  dashboardTitle,
  onHide = () => {},
  onlyApply = false,
  onSubmit = () => {},
  show = false,
}: PropertiesModalProps) => {
  const dispatch = useDispatch();
  const [form] = Form.useForm();
  const [isLoading, setIsLoading] = useState(false);
  const [colorScheme, setCurrentColorScheme] = useState(currentColorScheme);
  const [jsonMetadata, setJsonMetadata] = useState('');
  const [dashboardInfo, setDashboardInfo] = useState<DashboardInfo>();

  // JSON validation for metadata
  const jsonAnnotations = useJsonValidation(jsonMetadata, {
    errorPrefix: 'Invalid JSON metadata',
  });
  const [owners, setOwners] = useState<Owners>([]);
  const [roles, setRoles] = useState<Roles>([]);
  const saveLabel = onlyApply ? t('Apply') : t('Save');
  const [tags, setTags] = useState<TagType[]>([]);
  const [customCss, setCustomCss] = useState('');
  const [refreshFrequency, setRefreshFrequency] = useState(0);
  const [selectedThemeId, setSelectedThemeId] = useState<number | null>(null);
  const [themes, setThemes] = useState<
    Array<{
      id: number;
      theme_name: string;
    }>
  >([]);
  const categoricalSchemeRegistry = getCategoricalSchemeRegistry();
  const originalDashboardMetadata = useRef<Record<string, any>>({});

  const handleErrorResponse = async (response: Response) => {
    const { error, statusText, message } = await getClientErrorObject(response);
    let errorText = error || statusText || t('An error has occurred');
    if (typeof message === 'object' && 'json_metadata' in message) {
      errorText = (message as { json_metadata: string }).json_metadata;
    } else if (typeof message === 'string') {
      errorText = message;

      if (message === 'Forbidden') {
        errorText = t('You do not have permission to edit this dashboard');
      }
    }

    Modal.error({
      title: t('Error'),
      content: errorText,
      okButtonProps: { danger: true, className: 'btn-danger' },
    });
  };

  const handleDashboardData = useCallback(
    dashboardData => {
      const {
        id,
        dashboard_title,
        slug,
        certified_by,
        certification_details,
        owners,
        roles,
        metadata,
        is_managed_externally,
        theme_id,
        css,
      } = dashboardData;
      const dashboardInfo = {
        id,
        title: dashboard_title,
        slug: slug || '',
        certifiedBy: certified_by || '',
        certificationDetails: certification_details || '',
        isManagedExternally: is_managed_externally || false,
        css: css || '',
        metadata,
      };

      form.setFieldsValue(dashboardInfo);
      setDashboardInfo(dashboardInfo);
      setOwners(owners);
      setRoles(roles);
      setCustomCss(css || '');
      setCurrentColorScheme(metadata?.color_scheme);
      setSelectedThemeId(theme_id || null);

      const metaDataCopy = omit(metadata, [
        'positions',
        'shared_label_colors',
        'map_label_colors',
        'color_scheme_domain',
      ]);

      setJsonMetadata(metaDataCopy ? jsonStringify(metaDataCopy) : '');
      setRefreshFrequency(metadata?.refresh_frequency || 0);
      originalDashboardMetadata.current = metadata;
    },
    [form],
  );

  const fetchDashboardDetails = useCallback(() => {
    setIsLoading(true);
    // We fetch the dashboard details because not all code
    // that renders this component have all the values we need.
    // At some point when we have a more consistent frontend
    // datamodel, the dashboard could probably just be passed as a prop.
    SupersetClient.get({
      endpoint: `/api/v1/dashboard/${dashboardId}`,
    }).then(response => {
      const dashboard = response.json.result;
      const jsonMetadataObj = dashboard.json_metadata?.length
        ? JSON.parse(dashboard.json_metadata)
        : {};

      handleDashboardData({
        ...dashboard,
        metadata: jsonMetadataObj,
      });

      setIsLoading(false);
    }, handleErrorResponse);
  }, [dashboardId, handleDashboardData]);

  const getJsonMetadata = () => {
    try {
      const jsonMetadataObj = jsonMetadata?.length
        ? JSON.parse(jsonMetadata)
        : {};
      return jsonMetadataObj;
    } catch (_) {
      return {};
    }
  };

  const handleOnChangeOwners = (owners: { value: number; label: string }[]) => {
    const parsedOwners: Owners = ensureIsArray(owners).map(o => ({
      id: o.value,
      full_name: o.label,
    }));
    setOwners(parsedOwners);
  };

  const handleOnChangeRoles = (roles: { value: number; label: string }[]) => {
    const parsedRoles: Roles = ensureIsArray(roles).map(r => ({
      id: r.value,
      name: r.label,
    }));
    setRoles(parsedRoles);
  };

  const handleOnCancel = () => onHide();

  const onColorSchemeChange = (
    colorScheme = '',
    { updateMetadata = true } = {},
  ) => {
    // check that color_scheme is valid
    const colorChoices = categoricalSchemeRegistry.keys();
    const jsonMetadataObj = getJsonMetadata();

    // only fire if the color_scheme is present and invalid
    if (colorScheme && !colorChoices.includes(colorScheme)) {
      Modal.error({
        title: t('Error'),
        content: t('A valid color scheme is required'),
        okButtonProps: { danger: true, className: 'btn-danger' },
      });
      onHide();
      throw new Error('A valid color scheme is required');
    }

    jsonMetadataObj.color_scheme = colorScheme;
    jsonMetadataObj.label_colors = jsonMetadataObj.label_colors || {};

    setCurrentColorScheme(colorScheme);
    dispatch(setColorScheme(colorScheme));

    // update metadata to match selection
    if (updateMetadata) {
      setJsonMetadata(jsonStringify(jsonMetadataObj));
    }
  };

  const onFinish = () => {
    const { title, slug, certifiedBy, certificationDetails } =
      form.getFieldsValue();
    let currentJsonMetadata = jsonMetadata;

    // validate currentJsonMetadata
    let metadata;
    try {
      if (
        !currentJsonMetadata.startsWith('{') ||
        !currentJsonMetadata.endsWith('}')
      ) {
        throw new Error();
      }
      metadata = JSON.parse(currentJsonMetadata);
    } catch (error) {
      addDangerToast(t('JSON metadata is invalid!'));
      return;
    }

    const colorNamespace = getColorNamespace(metadata?.color_namespace);
    // color scheme in json metadata has precedence over selection
    const updatedColorScheme = metadata?.color_scheme || colorScheme;
    const shouldGoFresh =
      updatedColorScheme !== originalDashboardMetadata.current.color_scheme;
    const shouldResetCustomLabels = !areObjectsEqual(
      originalDashboardMetadata.current.label_colors || {},
      metadata?.label_colors || {},
    );
    const currentCustomLabels = Object.keys(metadata?.label_colors || {});
    const prevCustomLabels = Object.keys(
      originalDashboardMetadata.current.label_colors || {},
    );
    const resettableCustomLabels =
      currentCustomLabels.length > 0 ? currentCustomLabels : prevCustomLabels;
    const freshCustomLabels =
      shouldResetCustomLabels && resettableCustomLabels.length > 0
        ? resettableCustomLabels
        : false;
    const jsonMetadataObj = getJsonMetadata();
    jsonMetadataObj.refresh_frequency = refreshFrequency;
    const customLabelColors = jsonMetadataObj.label_colors || {};
    const updatedDashboardMetadata = {
      ...originalDashboardMetadata.current,
      label_colors: customLabelColors,
      color_scheme: updatedColorScheme,
    };

    originalDashboardMetadata.current = updatedDashboardMetadata;
    applyColors(updatedDashboardMetadata, shouldGoFresh || freshCustomLabels);
    dispatch(
      setDashboardMetadata({
        ...updatedDashboardMetadata,
        map_label_colors: getFreshLabelsColorMapEntries(customLabelColors),
      }),
    );

    onColorSchemeChange(updatedColorScheme, {
      updateMetadata: false,
    });

    currentJsonMetadata = jsonStringify(metadata);

    const moreOnSubmitProps: { roles?: Roles; tags?: TagType[] } = {};
    const morePutProps: {
      roles?: number[];
      tags?: (string | number | undefined)[];
    } = {};
    if (isFeatureEnabled(FeatureFlag.DashboardRbac)) {
      moreOnSubmitProps.roles = roles;
      morePutProps.roles = (roles || []).map(r => r.id);
    }
    if (isFeatureEnabled(FeatureFlag.TaggingSystem)) {
      moreOnSubmitProps.tags = tags;
      morePutProps.tags = tags.map(tag => tag.id);
    }
    const onSubmitProps = {
      id: dashboardId,
      title,
      slug,
      jsonMetadata: currentJsonMetadata,
      owners,
      colorScheme: currentColorScheme,
      colorNamespace,
      certifiedBy,
      certificationDetails,
      themeId: selectedThemeId,
      css: customCss,
      ...moreOnSubmitProps,
    };
    if (onlyApply) {
      onSubmit(onSubmitProps);
      onHide();
      addSuccessToast(t('Dashboard properties updated'));
    } else {
      SupersetClient.put({
        endpoint: `/api/v1/dashboard/${dashboardId}`,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dashboard_title: title,
          slug: slug || null,
          json_metadata: currentJsonMetadata || null,
          owners: (owners || []).map(o => o.id),
          certified_by: certifiedBy || null,
          certification_details:
            certifiedBy && certificationDetails ? certificationDetails : null,
          css: customCss || null,
          theme_id: selectedThemeId,
          ...morePutProps,
        }),
      }).then(() => {
        onSubmit(onSubmitProps);
        onHide();
        addSuccessToast(t('The dashboard has been saved'));
      }, handleErrorResponse);
    }
  };

  useEffect(() => {
    if (show) {
      if (!currentDashboardInfo) {
        fetchDashboardDetails();
      } else {
        handleDashboardData(currentDashboardInfo);
      }

      // Fetch themes (excluding system themes)
      const themeQuery = rison.encode({
        columns: ['id', 'theme_name', 'is_system'],
        filters: [
          {
            col: 'is_system',
            opr: 'eq',
            value: false,
          },
        ],
      });
      SupersetClient.get({ endpoint: `/api/v1/theme/?q=${themeQuery}` })
        .then(({ json }) => {
          const fetchedThemes = json.result;
          setThemes(fetchedThemes);
        })
        .catch(() => {
          addDangerToast(
            t('An error occurred while fetching available themes'),
          );
        });
    }

    JsonEditor.preload();
  }, [
    currentDashboardInfo,
    fetchDashboardDetails,
    handleDashboardData,
    show,
    addDangerToast,
  ]);

  useEffect(() => {
    // the title can be changed inline in the dashboard, this catches it
    if (
      dashboardTitle &&
      dashboardInfo &&
      dashboardInfo.title !== dashboardTitle
    ) {
      form.setFieldsValue({
        ...dashboardInfo,
        title: dashboardTitle,
      });
    }
  }, [dashboardInfo, dashboardTitle, form]);

  useEffect(() => {
    if (!isFeatureEnabled(FeatureFlag.TaggingSystem)) return;
    try {
      fetchTags(
        {
          objectType: OBJECT_TYPES.DASHBOARD,
          objectId: dashboardId,
          includeTypes: false,
        },
        (tags: TagType[]) => setTags(tags),
        (error: Response) => {
          addDangerToast(`Error fetching tags: ${error.text}`);
        },
      );
    } catch (error) {
      handleErrorResponse(error);
    }
  }, [dashboardId]);

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

  // Section handlers for extracted components
  const handleThemeChange = (value: any) => setSelectedThemeId(value || null);
  const handleRefreshFrequencyChange = (value: any) =>
    setRefreshFrequency(value);

  // Helper function for styling section
  const hasCustomLabelsColor = !!Object.keys(
    getJsonMetadata()?.label_colors || {},
  ).length;

  // Validation setup
  const modalSections = useMemo(
    () => [
      {
        key: 'basic',
        name: t('General Information'),
        validator: () => {
          const errors = [];
          const values = form.getFieldsValue();
          if (!values.title || values.title.trim().length === 0) {
            errors.push(t('Dashboard name is required'));
          }
          return errors;
        },
      },
      {
        key: 'access',
        name: t('Access & Ownership'),
        validator: () => [],
      },
      {
        key: 'styling',
        name: t('Styling'),
        validator: () => [],
      },
      {
        key: 'refresh',
        name: t('Refresh Settings'),
        validator: () => {
          const errors = [];
          const refreshLimit =
            dashboardInfo?.common?.conf
              ?.SUPERSET_DASHBOARD_PERIODICAL_REFRESH_LIMIT;
          if (
            refreshLimit &&
            refreshFrequency > 0 &&
            refreshFrequency < refreshLimit
          ) {
            errors.push(
              t(
                'Refresh frequency must be at least %s seconds',
                refreshLimit / 1000,
              ),
            );
          }
          return errors;
        },
      },
      {
        key: 'certification',
        name: t('Certification'),
        validator: () => [],
      },
      {
        key: 'advanced',
        name: t('Advanced Settings'),
        validator: () => {
          if (jsonAnnotations.length > 0) {
            return [t('Invalid JSON metadata')];
          }
          return [];
        },
      },
    ],
    [form, jsonAnnotations, refreshFrequency, dashboardInfo],
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

  // Validate basic section when title changes
  useEffect(() => {
    validateSection('basic');
  }, [dashboardTitle, validateSection]);

  // Validate advanced section when JSON changes
  useEffect(() => {
    validateSection('advanced');
  }, [jsonMetadata, validateSection]);

  // Validate refresh section when refresh frequency changes
  useEffect(() => {
    validateSection('refresh');
  }, [refreshFrequency, validateSection]);

  return (
    <StandardModal
      show={show}
      onHide={handleOnCancel}
      onSave={() => {
        if (validateAll()) {
          form.submit();
        }
      }}
      title={t('Dashboard Properties')}
      isEditMode
      saveDisabled={
        isLoading || dashboardInfo?.isManagedExternally || hasErrors
      }
      errorTooltip={
        dashboardInfo?.isManagedExternally
          ? t(
              "This dashboard is managed externally, and can't be edited in Superset",
            )
          : errorTooltip
      }
      saveText={saveLabel}
      wrapProps={{ 'data-test': 'properties-edit-modal' }}
    >
      <Form
        form={form}
        onFinish={onFinish}
        data-test="dashboard-edit-properties-form"
        layout="vertical"
        initialValues={dashboardInfo}
      >
        <Collapse
          expandIconPosition="end"
          defaultActiveKey="basic"
          modalMode
          items={[
            {
              key: 'basic',
              label: (
                <CollapseLabelInModal
                  title={t('General Information')}
                  subtitle={t('Dashboard name and URL configuration')}
                  validateCheckStatus={!validationStatus.basic?.hasErrors}
                  testId="basic-section"
                />
              ),
              children: (
                <BasicInfoSection
                  form={form}
                  isLoading={isLoading}
                  validationStatus={validationStatus}
                />
              ),
            },
            {
              key: 'access',
              label: (
                <CollapseLabelInModal
                  title={t('Access & Ownership')}
                  subtitle={t('Manage dashboard owners and access permissions')}
                  validateCheckStatus={!validationStatus.access?.hasErrors}
                  testId="access-section"
                />
              ),
              children: (
                <AccessSection
                  isLoading={isLoading}
                  owners={owners}
                  roles={roles}
                  tags={tags}
                  onChangeOwners={handleOnChangeOwners}
                  onChangeRoles={handleOnChangeRoles}
                  onChangeTags={handleChangeTags}
                  onClearTags={handleClearTags}
                />
              ),
            },
            {
              key: 'styling',
              label: (
                <CollapseLabelInModal
                  title={t('Styling')}
                  subtitle={t(
                    'Configure dashboard appearance, colors, and custom CSS',
                  )}
                  validateCheckStatus={!validationStatus.styling?.hasErrors}
                  testId="styling-section"
                />
              ),
              children: (
                <StylingSection
                  themes={themes}
                  selectedThemeId={selectedThemeId}
                  colorScheme={colorScheme}
                  customCss={customCss}
                  hasCustomLabelsColor={hasCustomLabelsColor}
                  onThemeChange={handleThemeChange}
                  onColorSchemeChange={onColorSchemeChange}
                  onCustomCssChange={setCustomCss}
                />
              ),
            },
            {
              key: 'refresh',
              label: (
                <CollapseLabelInModal
                  title={t('Refresh Settings')}
                  subtitle={t('Configure automatic dashboard refresh')}
                  validateCheckStatus={!validationStatus.refresh?.hasErrors}
                  testId="refresh-section"
                />
              ),
              children: (
                <RefreshSection
                  refreshFrequency={refreshFrequency}
                  onRefreshFrequencyChange={handleRefreshFrequencyChange}
                />
              ),
            },
            {
              key: 'certification',
              label: (
                <CollapseLabelInModal
                  title={t('Certification')}
                  subtitle={t('Add certification details for this dashboard')}
                  validateCheckStatus={
                    !validationStatus.certification?.hasErrors
                  }
                  testId="certification-section"
                />
              ),
              children: <CertificationSection isLoading={isLoading} />,
            },
            {
              key: 'advanced',
              label: (
                <CollapseLabelInModal
                  title={t('Advanced Settings')}
                  subtitle={t('JSON metadata and advanced configuration')}
                  validateCheckStatus={!validationStatus.advanced?.hasErrors}
                  testId="advanced-section"
                />
              ),
              children: (
                <AdvancedSection
                  jsonMetadata={jsonMetadata}
                  jsonAnnotations={jsonAnnotations}
                  validationStatus={validationStatus}
                  onJsonMetadataChange={setJsonMetadata}
                />
              ),
            },
          ]}
        />
      </Form>
    </StandardModal>
  );
};

export default withToasts(PropertiesModal);
