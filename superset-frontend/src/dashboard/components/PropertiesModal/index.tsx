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
import React, { useCallback, useEffect, useState } from 'react';
import { Input } from 'src/components/Input';
import { FormItem } from 'src/components/Form';
import jsonStringify from 'json-stringify-pretty-compact';
import Button from 'src/components/Button';
import { AntdForm, AsyncSelect, Col, Row } from 'src/components';
import rison from 'rison';
import {
  CategoricalColorNamespace,
  ensureIsArray,
  getCategoricalSchemeRegistry,
  getSharedLabelColor,
  styled,
  SupersetClient,
  t,
} from '@superset-ui/core';

import Modal from 'src/components/Modal';
import { JsonEditor } from 'src/components/AsyncAceEditor';

import ColorSchemeControlWrapper from 'src/dashboard/components/ColorSchemeControlWrapper';
import FilterScopeModal from 'src/dashboard/components/filterscope/FilterScopeModal';
import { getClientErrorObject } from 'src/utils/getClientErrorObject';
import withToasts from 'src/components/MessageToasts/withToasts';
import { FeatureFlag, isFeatureEnabled } from 'src/featureFlags';

const StyledFormItem = styled(FormItem)`
  margin-bottom: 0;
`;

const StyledJsonEditor = styled(JsonEditor)`
  border-radius: ${({ theme }) => theme.borderRadius}px;
  border: 1px solid ${({ theme }) => theme.colors.secondary.light2};
`;

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
  const [form] = AntdForm.useForm();
  const [isLoading, setIsLoading] = useState(false);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [colorScheme, setColorScheme] = useState(currentColorScheme);
  const [jsonMetadata, setJsonMetadata] = useState('');
  const [dashboardInfo, setDashboardInfo] = useState<DashboardInfo>();
  const [owners, setOwners] = useState<Owners>([]);
  const [roles, setRoles] = useState<Roles>([]);
  const saveLabel = onlyApply ? t('Apply') : t('Save');
  const categoricalSchemeRegistry = getCategoricalSchemeRegistry();

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

  const loadAccessOptions = useCallback(
    (accessType = 'owners', input = '', page: number, pageSize: number) => {
      const query = rison.encode({
        filter: input,
        page,
        page_size: pageSize,
      });
      return SupersetClient.get({
        endpoint: `/api/v1/dashboard/related/${accessType}?q=${query}`,
      }).then(response => ({
        data: response.json.result
          .filter((item: { extra: { active: boolean } }) =>
            item.extra.active !== undefined ? item.extra.active : true,
          )
          .map((item: { value: number; text: string }) => ({
            value: item.value,
            label: item.text,
          })),
        totalCount: response.json.count,
      }));
    },
    [],
  );

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
      } = dashboardData;
      const dashboardInfo = {
        id,
        title: dashboard_title,
        slug: slug || '',
        certifiedBy: certified_by || '',
        certificationDetails: certification_details || '',
        isManagedExternally: is_managed_externally || false,
      };

      form.setFieldsValue(dashboardInfo);
      setDashboardInfo(dashboardInfo);
      setOwners(owners);
      setRoles(roles);
      setColorScheme(metadata.color_scheme);

      // temporary fix to remove positions from dashboards' metadata
      if (metadata?.positions) {
        delete metadata.positions;
      }
      const metaDataCopy = { ...metadata };

      delete metaDataCopy.shared_label_colors;

      delete metaDataCopy.color_scheme_domain;

      setJsonMetadata(metaDataCopy ? jsonStringify(metaDataCopy) : '');
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

  const handleOwnersSelectValue = () => {
    const parsedOwners = (owners || []).map(
      (owner: {
        id: number;
        first_name?: string;
        last_name?: string;
        full_name?: string;
      }) => ({
        value: owner.id,
        label: owner.full_name || `${owner.first_name} ${owner.last_name}`,
      }),
    );
    return parsedOwners;
  };

  const handleRolesSelectValue = () => {
    const parsedRoles = (roles || []).map(
      (role: { id: number; name: string }) => ({
        value: role.id,
        label: `${role.name}`,
      }),
    );
    return parsedRoles;
  };

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
      throw new Error('A valid color scheme is required');
    }

    // update metadata to match selection
    if (updateMetadata) {
      jsonMetadataObj.color_scheme = colorScheme;
      jsonMetadataObj.label_colors = jsonMetadataObj.label_colors || {};

      setJsonMetadata(jsonStringify(jsonMetadataObj));
    }
    setColorScheme(colorScheme);
  };

  const onFinish = () => {
    const { title, slug, certifiedBy, certificationDetails } =
      form.getFieldsValue();
    let currentColorScheme = colorScheme;
    let colorNamespace = '';
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

    // color scheme in json metadata has precedence over selection
    currentColorScheme = metadata?.color_scheme || colorScheme;
    colorNamespace = metadata?.color_namespace;

    // filter shared_label_color from user input
    if (metadata?.shared_label_colors) {
      delete metadata.shared_label_colors;
    }
    if (metadata?.color_scheme_domain) {
      delete metadata.color_scheme_domain;
    }

    const sharedLabelColor = getSharedLabelColor();
    const categoricalNamespace =
      CategoricalColorNamespace.getNamespace(colorNamespace);
    categoricalNamespace.resetColors();
    if (currentColorScheme) {
      sharedLabelColor.updateColorMap(colorNamespace, currentColorScheme);
      metadata.shared_label_colors = Object.fromEntries(
        sharedLabelColor.getColorMap(),
      );
      metadata.color_scheme_domain =
        categoricalSchemeRegistry.get(colorScheme)?.colors || [];
    } else {
      sharedLabelColor.reset();
      metadata.shared_label_colors = {};
      metadata.color_scheme_domain = [];
    }

    currentJsonMetadata = jsonStringify(metadata);

    onColorSchemeChange(currentColorScheme, {
      updateMetadata: false,
    });

    const moreOnSubmitProps: { roles?: Roles } = {};
    const morePutProps: { roles?: number[] } = {};
    if (isFeatureEnabled(FeatureFlag.DASHBOARD_RBAC)) {
      moreOnSubmitProps.roles = roles;
      morePutProps.roles = (roles || []).map(r => r.id);
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
          ...morePutProps,
        }),
      }).then(() => {
        onSubmit(onSubmitProps);
        onHide();
        addSuccessToast(t('The dashboard has been saved'));
      }, handleErrorResponse);
    }
  };

  const getRowsWithoutRoles = () => {
    const jsonMetadataObj = getJsonMetadata();
    const hasCustomLabelColors = !!Object.keys(
      jsonMetadataObj?.label_colors || {},
    ).length;

    return (
      <Row gutter={16}>
        <Col xs={24} md={12}>
          <h3 style={{ marginTop: '1em' }}>{t('Access')}</h3>
          <StyledFormItem label={t('Owners')}>
            <AsyncSelect
              allowClear
              ariaLabel={t('Owners')}
              disabled={isLoading}
              mode="multiple"
              onChange={handleOnChangeOwners}
              options={(input, page, pageSize) =>
                loadAccessOptions('owners', input, page, pageSize)
              }
              value={handleOwnersSelectValue()}
            />
          </StyledFormItem>
          <p className="help-block">
            {t(
              'Owners is a list of users who can alter the dashboard. Searchable by name or username.',
            )}
          </p>
        </Col>
        <Col xs={24} md={12}>
          <h3 style={{ marginTop: '1em' }}>{t('Colors')}</h3>
          <ColorSchemeControlWrapper
            hasCustomLabelColors={hasCustomLabelColors}
            onChange={onColorSchemeChange}
            colorScheme={colorScheme}
            labelMargin={4}
          />
        </Col>
      </Row>
    );
  };

  const getRowsWithRoles = () => {
    const jsonMetadataObj = getJsonMetadata();
    const hasCustomLabelColors = !!Object.keys(
      jsonMetadataObj?.label_colors || {},
    ).length;

    return (
      <>
        <Row>
          <Col xs={24} md={24}>
            <h3 style={{ marginTop: '1em' }}>{t('Access')}</h3>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col xs={24} md={12}>
            <StyledFormItem label={t('Owners')}>
              <AsyncSelect
                allowClear
                ariaLabel={t('Owners')}
                disabled={isLoading}
                mode="multiple"
                onChange={handleOnChangeOwners}
                options={(input, page, pageSize) =>
                  loadAccessOptions('owners', input, page, pageSize)
                }
                value={handleOwnersSelectValue()}
              />
            </StyledFormItem>
            <p className="help-block">
              {t(
                'Owners is a list of users who can alter the dashboard. Searchable by name or username.',
              )}
            </p>
          </Col>
          <Col xs={24} md={12}>
            <StyledFormItem label={t('Roles')}>
              <AsyncSelect
                allowClear
                ariaLabel={t('Roles')}
                disabled={isLoading}
                mode="multiple"
                onChange={handleOnChangeRoles}
                options={(input, page, pageSize) =>
                  loadAccessOptions('roles', input, page, pageSize)
                }
                value={handleRolesSelectValue()}
              />
            </StyledFormItem>
            <p className="help-block">
              {t(
                'Roles is a list which defines access to the dashboard. Granting a role access to a dashboard will bypass dataset level checks. If no roles are defined, then the dashboard is available to all roles.',
              )}
            </p>
          </Col>
        </Row>
        <Row>
          <Col xs={24} md={12}>
            <ColorSchemeControlWrapper
              hasCustomLabelColors={hasCustomLabelColors}
              onChange={onColorSchemeChange}
              colorScheme={colorScheme}
              labelMargin={4}
            />
          </Col>
        </Row>
      </>
    );
  };

  useEffect(() => {
    if (show) {
      if (!currentDashboardInfo) {
        fetchDashboardDetails();
      } else {
        handleDashboardData(currentDashboardInfo);
      }
    }

    JsonEditor.preload();
  }, [currentDashboardInfo, fetchDashboardDetails, handleDashboardData, show]);

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

  return (
    <Modal
      show={show}
      onHide={onHide}
      title={t('Dashboard properties')}
      footer={
        <>
          <Button
            htmlType="button"
            buttonSize="small"
            onClick={onHide}
            data-test="properties-modal-cancel-button"
            cta
          >
            {t('Cancel')}
          </Button>
          <Button
            data-test="properties-modal-apply-button"
            onClick={form.submit}
            buttonSize="small"
            buttonStyle="primary"
            className="m-r-5"
            cta
            disabled={dashboardInfo?.isManagedExternally}
            tooltip={
              dashboardInfo?.isManagedExternally
                ? t(
                    "This dashboard is managed externally, and can't be edited in Superset",
                  )
                : ''
            }
          >
            {saveLabel}
          </Button>
        </>
      }
      responsive
    >
      <AntdForm
        form={form}
        onFinish={onFinish}
        data-test="dashboard-edit-properties-form"
        layout="vertical"
        initialValues={dashboardInfo}
      >
        <Row>
          <Col xs={24} md={24}>
            <h3>{t('Basic information')}</h3>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col xs={24} md={12}>
            <FormItem label={t('Title')} name="title">
              <Input
                data-test="dashboard-title-input"
                type="text"
                disabled={isLoading}
              />
            </FormItem>
          </Col>
          <Col xs={24} md={12}>
            <StyledFormItem label={t('URL slug')} name="slug">
              <Input type="text" disabled={isLoading} />
            </StyledFormItem>
            <p className="help-block">
              {t('A readable URL for your dashboard')}
            </p>
          </Col>
        </Row>
        {isFeatureEnabled(FeatureFlag.DASHBOARD_RBAC)
          ? getRowsWithRoles()
          : getRowsWithoutRoles()}
        <Row>
          <Col xs={24} md={24}>
            <h3>{t('Certification')}</h3>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col xs={24} md={12}>
            <StyledFormItem label={t('Certified by')} name="certifiedBy">
              <Input type="text" disabled={isLoading} />
            </StyledFormItem>
            <p className="help-block">
              {t('Person or group that has certified this dashboard.')}
            </p>
          </Col>
          <Col xs={24} md={12}>
            <StyledFormItem
              label={t('Certification details')}
              name="certificationDetails"
            >
              <Input type="text" disabled={isLoading} />
            </StyledFormItem>
            <p className="help-block">
              {t('Any additional detail to show in the certification tooltip.')}
            </p>
          </Col>
        </Row>
        <Row>
          <Col xs={24} md={24}>
            <h3 style={{ marginTop: '1em' }}>
              <Button
                buttonStyle="link"
                onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
              >
                <i
                  className={`fa fa-angle-${isAdvancedOpen ? 'down' : 'right'}`}
                  style={{ minWidth: '1em' }}
                />
                {t('Advanced')}
              </Button>
            </h3>
            {isAdvancedOpen && (
              <>
                <StyledFormItem label={t('JSON metadata')}>
                  <StyledJsonEditor
                    showLoadingForImport
                    name="json_metadata"
                    value={jsonMetadata}
                    onChange={setJsonMetadata}
                    tabSize={2}
                    width="100%"
                    height="200px"
                    wrapEnabled
                  />
                </StyledFormItem>
                <p className="help-block">
                  {t(
                    'This JSON object is generated dynamically when clicking the save or overwrite button in the dashboard view. It is exposed here for reference and for power users who may want to alter specific parameters.',
                  )}
                  {onlyApply && (
                    <>
                      {' '}
                      {t(
                        'Please DO NOT overwrite the "filter_scopes" key.',
                      )}{' '}
                      <FilterScopeModal
                        triggerNode={
                          <span className="alert-link">
                            {t('Use "%(menuName)s" menu instead.', {
                              menuName: t('Set filter mapping'),
                            })}
                          </span>
                        }
                      />
                    </>
                  )}
                </p>
              </>
            )}
          </Col>
        </Row>
      </AntdForm>
    </Modal>
  );
};

export default withToasts(PropertiesModal);
