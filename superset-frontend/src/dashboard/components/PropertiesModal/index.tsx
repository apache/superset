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
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Form, Row, Col, Input } from 'src/common/components';
import jsonStringify from 'json-stringify-pretty-compact';
import Button from 'src/components/Button';
import { Select } from 'src/components';
import rison from 'rison';
import {
  styled,
  t,
  SupersetClient,
  getCategoricalSchemeRegistry,
} from '@superset-ui/core';

import Modal from 'src/components/Modal';
import { JsonEditor } from 'src/components/AsyncAceEditor';

import ColorSchemeControlWrapper from 'src/dashboard/components/ColorSchemeControlWrapper';
import { getClientErrorObject } from 'src/utils/getClientErrorObject';
import withToasts from 'src/components/MessageToasts/withToasts';
import { FeatureFlag, isFeatureEnabled } from 'src/featureFlags';
import { SelectValue } from 'antd/lib/select';

const FormItem = Form.Item;

const StyledFormItem = styled(FormItem)`
  margin-bottom: 0;
`;

const StyledJsonEditor = styled(JsonEditor)`
  border-radius: ${({ theme }) => theme.borderRadius}px;
  border: 1px solid ${({ theme }) => theme.colors.secondary.light2};
`;

type PropertiesModalProps = {
  dashboardId: number;
  show?: boolean;
  onHide?: () => void;
  colorScheme?: string;
  setColorSchemeAndUnsavedChanges?: () => void;
  onSubmit?: (params: Record<string, any>) => void;
  addSuccessToast: (message: string) => void;
  onlyApply?: boolean;
};

const PropertiesModal = ({
  addSuccessToast,
  colorScheme: currentColorScheme,
  dashboardId,
  onHide = () => {},
  onlyApply = false,
  onSubmit = () => {},
  show = false,
}: PropertiesModalProps) => {
  const [form] = Form.useForm();
  const [isLoading, setIsLoading] = useState(true);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [colorScheme, setColorScheme] = useState(currentColorScheme);
  const [jsonMetadata, setJsonMetadata] = useState('');
  const [dashboardInfo, setDashboardInfo] = useState({
    id: dashboardId,
    title: '',
    slug: '',
    certifiedBy: '',
    certificationDetails: '',
  });
  const [owners, setOwners] = useState<SelectValue | null>(null);
  const [roles, setRoles] = useState<SelectValue | null>(null);
  const saveLabel = onlyApply ? t('Apply') : t('Save');

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
      title: 'Error',
      content: errorText,
      okButtonProps: { danger: true, className: 'btn-danger' },
    });
  };

  const loadAccessOptions = useMemo(
    () =>
      (accessType = 'owners', input = '', page: number, pageSize: number) => {
        const query = rison.encode({
          filter: input,
          page,
          page_size: pageSize,
        });
        return SupersetClient.get({
          endpoint: `/api/v1/dashboard/related/${accessType}?q=${query}`,
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
      const initialSelectedOwners = dashboard.owners.map(
        (owner: { id: number; first_name: string; last_name: string }) => ({
          value: owner.id,
          label: `${owner.first_name} ${owner.last_name}`,
        }),
      );
      const initialSelectedRoles = dashboard.roles.map(
        (role: { id: number; name: string }) => ({
          value: role.id,
          label: `${role.name}`,
        }),
      );
      const fetchedInfo = {
        id: dashboardId,
        title: dashboard.dashboard_title || '',
        slug: dashboard.slug || '',
        certifiedBy: dashboard.certified_by || '',
        certificationDetails: dashboard.certification_details || '',
      };

      form.setFieldsValue(fetchedInfo);
      setDashboardInfo(fetchedInfo);
      setOwners(initialSelectedOwners);
      setRoles(initialSelectedRoles);
      setJsonMetadata(
        dashboard.json_metadata ? jsonStringify(jsonMetadataObj) : '',
      );
      setColorScheme(jsonMetadataObj.color_scheme);
      setIsLoading(false);
    }, handleErrorResponse);
  }, [dashboardId, form]);

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

  const onColorSchemeChange = (
    colorScheme?: string,
    { updateMetadata = true } = {},
  ) => {
    // check that color_scheme is valid
    const colorChoices = getCategoricalSchemeRegistry().keys();
    const jsonMetadataObj = getJsonMetadata();

    // only fire if the color_scheme is present and invalid
    if (colorScheme && !colorChoices.includes(colorScheme)) {
      Modal.error({
        title: 'Error',
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
    const ownersIds = Array.isArray(owners)
      ? (
          owners as {
            value: number;
            label: string;
          }[]
        ).map(o => o.value)
      : [];
    const rolesIds = Array.isArray(roles)
      ? (
          roles as {
            value: number;
            label: string;
          }[]
        ).map(r => r.value)
      : [];

    // color scheme in json metadata has precedence over selection
    if (jsonMetadata?.length) {
      const metadata = JSON.parse(jsonMetadata);
      currentColorScheme = metadata?.color_scheme || colorScheme;
    }

    onColorSchemeChange(currentColorScheme, {
      updateMetadata: false,
    });

    const moreProps: Record<string, number[]> = {};
    const morePutProps: Record<string, number[]> = {};
    if (isFeatureEnabled(FeatureFlag.DASHBOARD_RBAC)) {
      moreProps.rolesIds = rolesIds;
      morePutProps.roles = rolesIds;
    }
    if (onlyApply) {
      onSubmit({
        id: dashboardId,
        title,
        slug,
        jsonMetadata,
        ownerIds: ownersIds,
        colorScheme: currentColorScheme,
        certifiedBy,
        certificationDetails,
        ...moreProps,
      });
      onHide();
    } else {
      SupersetClient.put({
        endpoint: `/api/v1/dashboard/${dashboardId}`,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dashboard_title: title,
          slug: slug || null,
          json_metadata: jsonMetadata || null,
          owners: ownersIds,
          certified_by: certifiedBy || null,
          certification_details:
            certifiedBy && certificationDetails ? certificationDetails : null,
          ...morePutProps,
        }),
      }).then(({ json: { result } }) => {
        const moreResultProps: Record<string, []> = {};
        if (isFeatureEnabled(FeatureFlag.DASHBOARD_RBAC)) {
          moreResultProps.rolesIds = result.roles;
        }
        addSuccessToast(t('The dashboard has been saved'));
        onSubmit({
          id: dashboardId,
          title: result.dashboard_title,
          slug: result.slug,
          jsonMetadata: result.json_metadata,
          ownerIds: result.owners,
          colorScheme: currentColorScheme,
          certifiedBy: result.certified_by,
          certificationDetails: result.certification_details,
          ...moreResultProps,
        });
        onHide();
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
          <FormItem label={t('Owners')} name="owners">
            <Select
              allowClear
              ariaLabel={t('Owners')}
              disabled={isLoading}
              mode="multiple"
              onChange={setOwners}
              options={(input, page, pageSize) =>
                loadAccessOptions('owners', input, page, pageSize)
              }
              value={owners || []}
            />
            <p className="help-block">
              {t(
                'Owners is a list of users who can alter the dashboard. Searchable by name or username.',
              )}
            </p>
          </FormItem>
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
            <FormItem label={t('Owners')} name="owners">
              <Select
                allowClear
                ariaLabel={t('Owners')}
                disabled={isLoading}
                mode="multiple"
                onChange={setOwners}
                options={(input, page, pageSize) =>
                  loadAccessOptions('owners', input, page, pageSize)
                }
                value={owners || []}
              />
              <p className="help-block">
                {t(
                  'Owners is a list of users who can alter the dashboard. Searchable by name or username.',
                )}
              </p>
            </FormItem>
          </Col>
          <Col xs={24} md={12}>
            <FormItem label={t('Roles')} name="roles">
              <Select
                allowClear
                ariaLabel={t('Roles')}
                disabled={isLoading}
                mode="multiple"
                onChange={setRoles}
                options={(input, page, pageSize) =>
                  loadAccessOptions('roles', input, page, pageSize)
                }
                value={roles || []}
              />
              <p className="help-block">
                {t(
                  'Roles is a list which defines access to the dashboard. Granting a role access to a dashboard will bypass dataset level checks. If no roles defined then the dashboard is available to all roles.',
                )}
              </p>
            </FormItem>
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
    fetchDashboardDetails();
    JsonEditor.preload();
  }, [fetchDashboardDetails]);

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
            onClick={form.submit}
            buttonSize="small"
            buttonStyle="primary"
            className="m-r-5"
            cta
          >
            {saveLabel}
          </Button>
        </>
      }
      responsive
    >
      <Form
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
            <FormItem label={t('URL slug')} name="slug">
              <Input type="text" disabled={isLoading} />
              <p className="help-block">
                {t('A readable URL for your dashboard')}
              </p>
            </FormItem>
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
              <FormItem label={t('JSON metadata')}>
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
                <p className="help-block">
                  {t(
                    'This JSON object is generated dynamically when clicking the save or overwrite button in the dashboard view. It is exposed here for reference and for power users who may want to alter specific parameters.',
                  )}
                </p>
              </FormItem>
            )}
          </Col>
        </Row>
      </Form>
    </Modal>
  );
};

export default withToasts(PropertiesModal);
