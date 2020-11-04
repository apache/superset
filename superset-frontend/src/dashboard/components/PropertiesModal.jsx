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
import { Row, Col, FormControl } from 'react-bootstrap';
import jsonStringify from 'json-stringify-pretty-compact';
import Button from 'src/components/Button';
import { AsyncSelect } from 'src/components/Select';
import rison from 'rison';
import {
  styled,
  t,
  SupersetClient,
  getCategoricalSchemeRegistry,
} from '@superset-ui/core';

import Modal from 'src/common/components/Modal';
import FormLabel from 'src/components/FormLabel';
import { JsonEditor } from 'src/components/AsyncAceEditor';

import ColorSchemeControlWrapper from 'src/dashboard/components/ColorSchemeControlWrapper';
import getClientErrorObject from '../../utils/getClientErrorObject';
import withToasts from '../../messageToasts/enhancers/withToasts';
import '../stylesheets/buttons.less';

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

const loadOwnerOptions = (input = '') => {
  const query = rison.encode({ filter: input });
  return SupersetClient.get({
    endpoint: `/api/v1/dashboard/related/owners?q=${query}`,
  }).then(
    response => {
      return response.json.result.map(item => ({
        value: item.value,
        label: item.text,
      }));
    },
    badResponse => {
      handleErrorResponse(badResponse);
      return [];
    },
  );
};

class PropertiesModal extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      errors: [],
      values: {
        dashboard_title: '',
        slug: '',
        owners: [],
        json_metadata: '',
        colorScheme: props.colorScheme,
      },
      isDashboardLoaded: false,
      isAdvancedOpen: false,
    };
    this.onChange = this.onChange.bind(this);
    this.onMetadataChange = this.onMetadataChange.bind(this);
    this.onOwnersChange = this.onOwnersChange.bind(this);
    this.submit = this.submit.bind(this);
    this.toggleAdvanced = this.toggleAdvanced.bind(this);
    this.onColorSchemeChange = this.onColorSchemeChange.bind(this);
  }

  componentDidMount() {
    this.fetchDashboardDetails();
    JsonEditor.preload();
  }

  onColorSchemeChange(value, { updateMetadata = true } = {}) {
    // check that color_scheme is valid
    const colorChoices = getCategoricalSchemeRegistry().keys();
    const { json_metadata: jsonMetadata } = this.state.values;
    const jsonMetadataObj = jsonMetadata?.length
      ? JSON.parse(jsonMetadata)
      : {};

    if (!colorChoices.includes(value)) {
      Modal.error({
        title: 'Error',
        content: t('A valid color scheme is required'),
        okButtonProps: { danger: true, className: 'btn-danger' },
      });
      throw new Error('A valid color scheme is required');
    }

    // update metadata to match selection
    if (
      updateMetadata &&
      Object.keys(jsonMetadataObj).includes('color_scheme')
    ) {
      jsonMetadataObj.color_scheme = value;
      this.onMetadataChange(jsonStringify(jsonMetadataObj));
    }

    this.updateFormState('colorScheme', value);
  }

  onOwnersChange(value) {
    this.updateFormState('owners', value);
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
      this.onOwnersChange(initialSelectedOwners);
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
      },
    } = this.state;
    const { onlyApply } = this.props;
    const owners = ownersValue.map(o => o.value);
    let metadataColorScheme;

    // update color scheme to match metadata
    if (jsonMetadata?.length) {
      const { color_scheme: metadataColorScheme } = JSON.parse(jsonMetadata);
      if (metadataColorScheme) {
        this.onColorSchemeChange(metadataColorScheme, {
          updateMetadata: false,
        });
      }
    }

    if (onlyApply) {
      this.props.onSubmit({
        id: this.props.dashboardId,
        title: dashboardTitle,
        slug,
        jsonMetadata,
        ownerIds: owners,
        colorScheme: metadataColorScheme || colorScheme,
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
        }),
      }).then(({ json: { result } }) => {
        this.props.addSuccessToast(t('The dashboard has been saved'));
        this.props.onSubmit({
          id: this.props.dashboardId,
          title: result.dashboard_title,
          slug: result.slug,
          jsonMetadata: result.json_metadata,
          ownerIds: result.owners,
          colorScheme: metadataColorScheme || colorScheme,
        });
        this.props.onHide();
      }, handleErrorResponse);
    }
  }

  render() {
    const { values, isDashboardLoaded, isAdvancedOpen, errors } = this.state;
    const { onHide, onlyApply } = this.props;

    const saveLabel = onlyApply ? t('Apply') : t('Save');

    return (
      <Modal
        show={this.props.show}
        onHide={this.props.onHide}
        title={t('Dashboard Properties')}
        footer={
          <>
            <Button
              type="button"
              buttonSize="sm"
              onClick={onHide}
              data-test="properties-modal-cancel-button"
              cta
            >
              {t('Cancel')}
            </Button>
            <Button
              onClick={this.submit}
              buttonSize="sm"
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
        <form data-test="dashboard-edit-properties-form" onSubmit={this.submit}>
          <Row>
            <Col md={12}>
              <h3>{t('Basic Information')}</h3>
            </Col>
          </Row>
          <Row>
            <Col md={6}>
              <FormLabel htmlFor="embed-height">{t('Title')}</FormLabel>
              <FormControl
                data-test="dashboard-title-input"
                name="dashboard_title"
                type="text"
                bsSize="sm"
                value={values.dashboard_title}
                onChange={this.onChange}
                disabled={!isDashboardLoaded}
              />
            </Col>
            <Col md={6}>
              <FormLabel htmlFor="embed-height">{t('URL Slug')}</FormLabel>
              <FormControl
                name="slug"
                type="text"
                bsSize="sm"
                value={values.slug || ''}
                onChange={this.onChange}
                disabled={!isDashboardLoaded}
              />
              <p className="help-block">
                {t('A readable URL for your dashboard')}
              </p>
            </Col>
          </Row>
          <Row>
            <Col md={6}>
              <h3 style={{ marginTop: '1em' }}>{t('Access')}</h3>
              <FormLabel htmlFor="owners">{t('Owners')}</FormLabel>
              <AsyncSelect
                name="owners"
                isMulti
                value={values.owners}
                loadOptions={loadOwnerOptions}
                defaultOptions // load options on render
                cacheOptions
                onChange={this.onOwnersChange}
                disabled={!isDashboardLoaded}
                filterOption={null} // options are filtered at the api
              />
              <p className="help-block">
                {t(
                  'Owners is a list of users who can alter the dashboard. Searchable by name or username.',
                )}
              </p>
            </Col>
            <Col md={6}>
              <h3 style={{ marginTop: '1em' }}>{t('Colors')}</h3>
              <ColorSchemeControlWrapper
                onChange={this.onColorSchemeChange}
                colorScheme={values.colorScheme}
              />
            </Col>
          </Row>
          <Row>
            <Col md={12}>
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
                <>
                  <FormLabel htmlFor="json_metadata">
                    {t('JSON Metadata')}
                  </FormLabel>
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
                </>
              )}
            </Col>
          </Row>
        </form>
      </Modal>
    );
  }
}

PropertiesModal.propTypes = propTypes;
PropertiesModal.defaultProps = defaultProps;

export default withToasts(PropertiesModal);
