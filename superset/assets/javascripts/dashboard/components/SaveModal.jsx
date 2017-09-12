/* global notify */
import React from 'react';
import PropTypes from 'prop-types';
import { Button, FormControl, FormGroup, Radio } from 'react-bootstrap';
import { getAjaxErrorMsg } from '../../modules/utils';
import ModalTrigger from '../../components/ModalTrigger';
import { t } from '../../locales';
import Checkbox from '../../components/Checkbox';

const $ = window.$ = require('jquery');

const propTypes = {
  css: PropTypes.string,
  dashboard: PropTypes.object.isRequired,
  triggerNode: PropTypes.node.isRequired,
};

class SaveModal extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      dashboard: props.dashboard,
      css: props.css,
      saveType: 'overwrite',
      newDashName: props.dashboard.dashboard_title + ' [copy]',
      duplicateSlices: false,
    };
    this.modal = null;
    this.handleSaveTypeChange = this.handleSaveTypeChange.bind(this);
    this.handleNameChange = this.handleNameChange.bind(this);
    this.saveDashboard = this.saveDashboard.bind(this);
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
      saveType: 'newDashboard',
    });
  }
  saveDashboardRequest(data, url, saveType) {
    const dashboard = this.props.dashboard;
    const saveModal = this.modal;
    Object.assign(data, { css: this.props.css });
    $.ajax({
      type: 'POST',
      url,
      data: {
        data: JSON.stringify(data),
      },
      success(resp) {
        saveModal.close();
        dashboard.onSave();
        if (saveType === 'newDashboard') {
          window.location = `/superset/dashboard/${resp.id}/`;
        } else {
          notify.success(t('This dashboard was saved successfully.'));
        }
      },
      error(error) {
        saveModal.close();
        const errorMsg = getAjaxErrorMsg(error);
        notify.error(t('Sorry, there was an error saving this dashboard: ') + '</ br>' + errorMsg);
      },
    });
  }
  saveDashboard(saveType, newDashboardTitle) {
    const dashboard = this.props.dashboard;
    const expandedSlices = {};
    $.each($('.slice_info'), function () {
      const widget = $(this).parents('.widget');
      const sliceDescription = widget.find('.slice_description');
      if (sliceDescription.is(':visible')) {
        expandedSlices[$(widget).attr('data-slice-id')] = true;
      }
    });
    const positions = dashboard.reactGridLayout.serialize();
    const data = {
      positions,
      css: this.state.css,
      expanded_slices: expandedSlices,
      dashboard_title: dashboard.dashboard_title,
      default_filters: dashboard.readFilters(),
      duplicate_slices: this.state.duplicateSlices,
    };
    let url = null;
    if (saveType === 'overwrite') {
      url = `/superset/save_dash/${dashboard.id}/`;
      this.saveDashboardRequest(data, url, saveType);
    } else if (saveType === 'newDashboard') {
      if (!newDashboardTitle) {
        this.modal.close();
        showModal({
          title: t('Error'),
          body: t('You must pick a name for the new dashboard'),
        });
      } else {
        data.dashboard_title = newDashboardTitle;
        url = `/superset/copy_dash/${dashboard.id}/`;
        this.saveDashboardRequest(data, url, saveType);
      }
    }
  }
  render() {
    return (
      <ModalTrigger
        ref={(modal) => { this.modal = modal; }}
        triggerNode={this.props.triggerNode}
        modalTitle={t('Save Dashboard')}
        modalBody={
          <FormGroup>
            <Radio
              value="overwrite"
              onChange={this.handleSaveTypeChange}
              checked={this.state.saveType === 'overwrite'}
            >
              {t('Overwrite Dashboard [%s]', this.props.dashboard.dashboard_title)}
            </Radio>
            <hr />
            <Radio
              value="newDashboard"
              onChange={this.handleSaveTypeChange}
              checked={this.state.saveType === 'newDashboard'}
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
                onChange={this.toggleDuplicateSlices.bind(this)}
              />
              <span className="m-l-5">also copy (duplicate) slices</span>
            </div>
          </FormGroup>
        }
        modalFooter={
          <div>
            <Button
              bsStyle="primary"
              onClick={() => { this.saveDashboard(this.state.saveType, this.state.newDashName); }}
            >
              {t('Save')}
            </Button>
          </div>
        }
      />
    );
  }
}
SaveModal.propTypes = propTypes;

export default SaveModal;
