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
/* eslint-env browser */
import React from 'react';
import PropTypes from 'prop-types';
import { FormControl, FormGroup, Radio } from 'react-bootstrap';
import Button from 'src/components/Button';
import { t, CategoricalColorNamespace } from '@superset-ui/core';

import ModalTrigger from '../../components/ModalTrigger';
import Checkbox from '../../components/Checkbox';
import { SAVE_TYPE_OVERWRITE, SAVE_TYPE_NEWDASHBOARD } from '../util/constants';

const propTypes = {
  addSuccessToast: PropTypes.func.isRequired,
  addDangerToast: PropTypes.func.isRequired,
  dashboardId: PropTypes.number.isRequired,
  dashboardTitle: PropTypes.string.isRequired,
  dashboardInfo: PropTypes.object.isRequired,
  expandedSlices: PropTypes.object.isRequired,
  layout: PropTypes.object.isRequired,
  saveType: PropTypes.oneOf([SAVE_TYPE_OVERWRITE, SAVE_TYPE_NEWDASHBOARD]),
  triggerNode: PropTypes.node.isRequired,
  customCss: PropTypes.string.isRequired,
  colorNamespace: PropTypes.string,
  colorScheme: PropTypes.string,
  onSave: PropTypes.func.isRequired,
  isMenuItem: PropTypes.bool,
  canOverwrite: PropTypes.bool.isRequired,
  refreshFrequency: PropTypes.number.isRequired,
};

const defaultProps = {
  isMenuItem: false,
  saveType: SAVE_TYPE_OVERWRITE,
  colorNamespace: undefined,
  colorScheme: undefined,
};

class SaveModal extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      saveType: props.saveType,
      newDashName: `${props.dashboardTitle} [copy]`,
      duplicateSlices: false,
    };
    this.modal = null;
    this.handleSaveTypeChange = this.handleSaveTypeChange.bind(this);
    this.handleNameChange = this.handleNameChange.bind(this);
    this.saveDashboard = this.saveDashboard.bind(this);
    this.setModalRef = this.setModalRef.bind(this);
    this.toggleDuplicateSlices = this.toggleDuplicateSlices.bind(this);
    this.onSave = this.props.onSave.bind(this);
  }

  setModalRef(ref) {
    this.modal = ref;
  }

  toggleDuplicateSlices() {
    this.setState({ duplicateSlices: !this.state.duplicateSlices });
  }

  handleSaveTypeChange(event) {
    this.setState({
      saveType: event.target.value,
    });
  }

  handleNameChange(event) {
    this.setState({
      newDashName: event.target.value,
      saveType: SAVE_TYPE_NEWDASHBOARD,
    });
  }

  saveDashboard() {
    const { saveType, newDashName } = this.state;
    const {
      dashboardTitle,
      dashboardInfo,
      layout: positions,
      customCss,
      colorNamespace,
      colorScheme,
      expandedSlices,
      dashboardId,
      refreshFrequency: currentRefreshFrequency,
      shouldPersistRefreshFrequency,
    } = this.props;

    const scale = CategoricalColorNamespace.getScale(
      colorScheme,
      colorNamespace,
    );
    const labelColors = colorScheme ? scale.getColorMap() : {};
    // check refresh frequency is for current session or persist
    const refreshFrequency = shouldPersistRefreshFrequency
      ? currentRefreshFrequency
      : dashboardInfo.metadata.refresh_frequency; // eslint-disable camelcase

    const data = {
      positions,
      css: customCss,
      color_namespace: colorNamespace,
      color_scheme: colorScheme,
      label_colors: labelColors,
      expanded_slices: expandedSlices,
      dashboard_title:
        saveType === SAVE_TYPE_NEWDASHBOARD ? newDashName : dashboardTitle,
      duplicate_slices: this.state.duplicateSlices,
      refresh_frequency: refreshFrequency,
    };

    if (saveType === SAVE_TYPE_NEWDASHBOARD && !newDashName) {
      this.props.addDangerToast(
        t('You must pick a name for the new dashboard'),
      );
    } else {
      this.onSave(data, dashboardId, saveType).then(resp => {
        if (
          saveType === SAVE_TYPE_NEWDASHBOARD &&
          resp &&
          resp.json &&
          resp.json.id
        ) {
          window.location = `/superset/dashboard/${resp.json.id}/`;
        }
      });
      this.modal.close();
    }
  }

  render() {
    return (
      <ModalTrigger
        ref={this.setModalRef}
        isMenuItem={this.props.isMenuItem}
        triggerNode={this.props.triggerNode}
        modalTitle={t('Save Dashboard')}
        modalBody={
          <FormGroup>
            <Radio
              value={SAVE_TYPE_OVERWRITE}
              onChange={this.handleSaveTypeChange}
              checked={this.state.saveType === SAVE_TYPE_OVERWRITE}
              disabled={!this.props.canOverwrite}
            >
              {t('Overwrite Dashboard [%s]', this.props.dashboardTitle)}
            </Radio>
            <hr />
            <Radio
              value={SAVE_TYPE_NEWDASHBOARD}
              onChange={this.handleSaveTypeChange}
              checked={this.state.saveType === SAVE_TYPE_NEWDASHBOARD}
            >
              {t('Save as:')}
            </Radio>
            <FormControl
              type="text"
              placeholder={t('[dashboard name]')}
              value={this.state.newDashName}
              onFocus={this.handleNameChange}
              onChange={this.handleNameChange}
            />
            <div className="m-l-25 m-t-5">
              <Checkbox
                checked={this.state.duplicateSlices}
                onChange={this.toggleDuplicateSlices}
              />
              <span className="m-l-5">{t('also copy (duplicate) charts')}</span>
            </div>
          </FormGroup>
        }
        modalFooter={
          <div>
            <Button buttonStyle="primary" onClick={this.saveDashboard}>
              {t('Save')}
            </Button>
          </div>
        }
      />
    );
  }
}

SaveModal.propTypes = propTypes;
SaveModal.defaultProps = defaultProps;

export default SaveModal;
