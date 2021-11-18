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
import React from 'react';
import PropTypes from 'prop-types';
import { Row, Col, Input } from 'src/common/components';
import { Form, FormItem } from 'src/components/Form';
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

const StyledJsonEditor = styled(JsonEditor)`
  border-radius: ${({ theme }) => theme.borderRadius}px;
  border: 1px solid ${({ theme }) => theme.colors.secondary.light2};
`;

const propTypes = {
  dashboardId: PropTypes.number.isRequired,
  show: PropTypes.bool,
  onHide: PropTypes.func,
  colorScheme: PropTypes.string,
  setColorSchemeAndUnsavedChanges: PropTypes.func,
  onSubmit: PropTypes.func,
  addSuccessToast: PropTypes.func.isRequired,
  onlyApply: PropTypes.bool,
};

const defaultProps = {
  onHide: () => {},
  setColorSchemeAndUnsavedChanges: () => {},
  onSubmit: () => {},
  show: false,
  colorScheme: undefined,
  onlyApply: false,
};

const handleErrorResponse = async response => {
  const { error, statusText, message } = await getClientErrorObject(response);
  let errorText = error || statusText || t('An error has occurred');

  if (typeof message === 'object' && message.json_metadata) {
    errorText = message.json_metadata;
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

const loadAccessOptions =
  accessType =>
  (input = '') => {
    const query = rison.encode({ filter: input });
    return SupersetClient.get({
      endpoint: `/api/v1/dashboard/related/${accessType}?q=${query}`,
    }).then(
      response => ({
        data: response.json.result.map(item => ({
          value: item.value,
          label: item.text,
        })),
        totalCount: response.json.count,
      }),
      badResponse => {
        handleErrorResponse(badResponse);
        return [];
      },
    );
  };

const loadOwners = loadAccessOptions('owners');
const loadRoles = loadAccessOptions('roles');

class PropertiesModal extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      errors: [],
      values: {
        dashboard_title: '',
        slug: '',
        owners: [],
        roles: [],
        json_metadata: '',
        colorScheme: props.colorScheme,
      },
      isDashboardLoaded: false,
      isAdvancedOpen: false,
    };
    this.onChange = this.onChange.bind(this);
    this.onMetadataChange = this.onMetadataChange.bind(this);
    this.onOwnersChange = this.onOwnersChange.bind(this);
    this.onRolesChange = this.onRolesChange.bind(this);
    this.submit = this.submit.bind(this);
    this.toggleAdvanced = this.toggleAdvanced.bind(this);
    this.onColorSchemeChange = this.onColorSchemeChange.bind(this);
    this.getRowsWithRoles = this.getRowsWithRoles.bind(this);
    this.getRowsWithoutRoles = this.getRowsWithoutRoles.bind(this);
    this.getJsonMetadata = this.getJsonMetadata.bind(this);
  }

  componentDidMount() {
    this.fetchDashboardDetails();
    JsonEditor.preload();
  }

  getJsonMetadata() {
    const { json_metadata: jsonMetadata } = this.state.values;
    try {
      const jsonMetadataObj = jsonMetadata?.length
        ? JSON.parse(jsonMetadata)
        : {};
      return jsonMetadataObj;
    } catch (_) {
      return {};
    }
  }

  onColorSchemeChange(colorScheme, { updateMetadata = true } = {}) {
    // check that color_scheme is valid
    const colorChoices = getCategoricalSchemeRegistry().keys();
    const jsonMetadataObj = this.getJsonMetadata();

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

      this.onMetadataChange(jsonStringify(jsonMetadataObj));
    }

    this.updateFormState('colorScheme', colorScheme);
  }

  onOwnersChange(value) {
    this.updateFormState('owners', value);
  }

  onRolesChange(value) {
    this.updateFormState('roles', value);
  }

  onMetadataChange(metadata) {
    this.updateFormState('json_metadata', metadata);
  }

  onChange(e) {
    const { name, value } = e.target;
    this.updateFormState(name, value);
  }

  fetchDashboardDetails() {
    // We fetch the dashboard details because not all code
    // that renders this component have all the values we need.
    // At some point when we have a more consistent frontend
    // datamodel, the dashboard could probably just be passed as a prop.
    SupersetClient.get({
      endpoint: `/api/v1/dashboard/${this.props.dashboardId}`,
    }).then(response => {
      const dashboard = response.json.result;
      const jsonMetadataObj = dashboard.json_metadata?.length
        ? JSON.parse(dashboard.json_metadata)
        : {};

      this.setState(state => ({
        isDashboardLoaded: true,
        values: {
          ...state.values,
          dashboard_title: dashboard.dashboard_title || '',
          slug: dashboard.slug || '',
          // format json with 2-space indentation
          json_metadata: dashboard.json_metadata
            ? jsonStringify(jsonMetadataObj)
            : '',
          colorScheme: jsonMetadataObj.color_scheme,
        },
      }));
      const initialSelectedOwners = dashboard.owners.map(owner => ({
        value: owner.id,
        label: `${owner.first_name} ${owner.last_name}`,
      }));
      const initialSelectedRoles = dashboard.roles.map(role => ({
        value: role.id,
        label: `${role.name}`,
      }));
      this.onOwnersChange(initialSelectedOwners);
      this.onRolesChange(initialSelectedRoles);
    }, handleErrorResponse);
  }

  updateFormState(name, value) {
    this.setState(state => ({
      values: {
        ...state.values,
        [name]: value,
      },
    }));
  }

  toggleAdvanced() {
    this.setState(state => ({
      isAdvancedOpen: !state.isAdvancedOpen,
    }));
  }

  submit(e) {
    e.preventDefault();
    e.stopPropagation();
    const {
      values: {
        json_metadata: jsonMetadata,
        slug,
        dashboard_title: dashboardTitle,
        colorScheme,
        owners: ownersValue,
        roles: rolesValue,
      },
    } = this.state;

    const { onlyApply } = this.props;
    const owners = ownersValue?.map(o => o.value) ?? [];
    const roles = rolesValue?.map(o => o.value) ?? [];
    let currentColorScheme = colorScheme;

    // color scheme in json metadata has precedence over selection
    if (jsonMetadata?.length) {
      const metadata = JSON.parse(jsonMetadata);
      currentColorScheme = metadata?.color_scheme || colorScheme;
    }

    this.onColorSchemeChange(currentColorScheme, {
      updateMetadata: false,
    });

    const moreProps = {};
    const morePutProps = {};
    if (isFeatureEnabled(FeatureFlag.DASHBOARD_RBAC)) {
      moreProps.rolesIds = roles;
      morePutProps.roles = roles;
    }
    if (onlyApply) {
      this.props.onSubmit({
        id: this.props.dashboardId,
        title: dashboardTitle,
        slug,
        jsonMetadata,
        ownerIds: owners,
        colorScheme: currentColorScheme,
        ...moreProps,
      });
      this.props.onHide();
    } else {
      SupersetClient.put({
        endpoint: `/api/v1/dashboard/${this.props.dashboardId}`,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dashboard_title: dashboardTitle,
          slug: slug || null,
          json_metadata: jsonMetadata || null,
          owners,
          ...morePutProps,
        }),
      }).then(({ json: { result } }) => {
        const moreResultProps = {};
        if (isFeatureEnabled(FeatureFlag.DASHBOARD_RBAC)) {
          moreResultProps.rolesIds = result.roles;
        }
        this.props.addSuccessToast(t('The dashboard has been saved'));
        this.props.onSubmit({
          id: this.props.dashboardId,
          title: result.dashboard_title,
          slug: result.slug,
          jsonMetadata: result.json_metadata,
          ownerIds: result.owners,
          colorScheme: currentColorScheme,
          ...moreResultProps,
        });
        this.props.onHide();
      }, handleErrorResponse);
    }
  }

  getRowsWithoutRoles() {
    const { values, isDashboardLoaded } = this.state;
    const jsonMetadataObj = this.getJsonMetadata();
    const hasCustomLabelColors = !!Object.keys(
      jsonMetadataObj?.label_colors || {},
    ).length;

    return (
      <Row gutter={16}>
        <Col xs={24} md={12}>
          <h3 style={{ marginTop: '1em' }}>{t('Access')}</h3>
          <FormItem label={t('Owners')}>
            <Select
              allowClear
              ariaLabel={t('Owners')}
              disabled={!isDashboardLoaded}
              name="owners"
              mode="multiple"
              value={values.owners}
              options={loadOwners}
              onChange={this.onOwnersChange}
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
            onChange={this.onColorSchemeChange}
            colorScheme={values.colorScheme}
            labelMargin={4}
          />
        </Col>
      </Row>
    );
  }

  getRowsWithRoles() {
    const { values, isDashboardLoaded } = this.state;
    const jsonMetadataObj = this.getJsonMetadata();
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
            <FormItem label={t('Owners')}>
              <Select
                allowClear
                ariaLabel={t('Owners')}
                disabled={!isDashboardLoaded}
                name="owners"
                mode="multiple"
                value={values.owners}
                options={loadOwners}
                onChange={this.onOwnersChange}
              />
              <p className="help-block">
                {t(
                  'Owners is a list of users who can alter the dashboard. Searchable by name or username.',
                )}
              </p>
            </FormItem>
          </Col>
          <Col xs={24} md={12}>
            <FormItem label={t('Roles')}>
              <Select
                allowClear
                ariaLabel={t('Roles')}
                disabled={!isDashboardLoaded}
                name="roles"
                mode="multiple"
                value={values.roles}
                options={loadRoles}
                onChange={this.onRolesChange}
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
              onChange={this.onColorSchemeChange}
              colorScheme={values.colorScheme}
              labelMargin={4}
            />
          </Col>
        </Row>
      </>
    );
  }

  render() {
    const { values, isDashboardLoaded, isAdvancedOpen, errors } = this.state;
    const { onHide, onlyApply } = this.props;

    const saveLabel = onlyApply ? t('Apply') : t('Save');

    return (
      <Modal
        show={this.props.show}
        onHide={this.props.onHide}
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
              onClick={this.submit}
              buttonSize="small"
              buttonStyle="primary"
              className="m-r-5"
              disabled={errors.length > 0}
              cta
            >
              {saveLabel}
            </Button>
          </>
        }
        responsive
      >
        <Form
          data-test="dashboard-edit-properties-form"
          onSubmit={this.submit}
          layout="vertical"
        >
          <Row>
            <Col xs={24} md={24}>
              <h3>{t('Basic information')}</h3>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <FormItem label={t('Title')}>
                <Input
                  data-test="dashboard-title-input"
                  name="dashboard_title"
                  type="text"
                  value={values.dashboard_title}
                  onChange={this.onChange}
                  disabled={!isDashboardLoaded}
                />
              </FormItem>
            </Col>
            <Col xs={24} md={12}>
              <FormItem label={t('URL slug')}>
                <Input
                  name="slug"
                  type="text"
                  value={values.slug || ''}
                  onChange={this.onChange}
                  disabled={!isDashboardLoaded}
                />
                <p className="help-block">
                  {t('A readable URL for your dashboard')}
                </p>
              </FormItem>
            </Col>
          </Row>
          {isFeatureEnabled(FeatureFlag.DASHBOARD_RBAC)
            ? this.getRowsWithRoles()
            : this.getRowsWithoutRoles()}
          <Row>
            <Col xs={24} md={24}>
              <h3 style={{ marginTop: '1em' }}>
                <Button buttonStyle="link" onClick={this.toggleAdvanced}>
                  <i
                    className={`fa fa-angle-${
                      isAdvancedOpen ? 'down' : 'right'
                    }`}
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
                    defaultValue={this.defaultMetadataValue}
                    value={values.json_metadata}
                    onChange={this.onMetadataChange}
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
  }
}

PropertiesModal.propTypes = propTypes;
PropertiesModal.defaultProps = defaultProps;

export default withToasts(PropertiesModal);
