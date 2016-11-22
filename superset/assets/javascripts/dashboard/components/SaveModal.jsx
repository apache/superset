const $ = window.$ = require('jquery');

import React from 'react';
import { Button } from 'react-bootstrap';
import { getAjaxErrorMsg, showModal } from '../../modules/utils';

import ModalTrigger from '../../components/ModalTrigger';

const propTypes = {
  css: React.PropTypes.string,
  dashboard: React.PropTypes.object.isRequired,
  newDashName: React.PropTypes.string,
  saveType: React.PropTypes.string.isRequired,
  triggerNode: React.PropTypes.node.isRequired,
};

const defaultProps = {
  saveType: 'overwrite',
};

class SaveModal extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      dashboard: props.dashboard,
      saveType: props.saveType,
      css: props.css,
    };

    this.modal = null;
    this.handleSaveTypeChange = this.handleSaveTypeChange.bind(this);
    this.handleNameChange = this.handleNameChange.bind(this);
    this.saveDashboard = this.saveDashboard.bind(this);
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
  saveDashboard(saveType, newDashboardTitle) {
    const dashboard = this.props.dashboard;
    const saveModal = this.modal;

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
    };
    let url = null;
    if (saveType === 'overwrite') {
      url = '/superset/save_dash/' + dashboard.id + '/';
    } else if (saveType === 'newDashboard') {
      url = '/superset/copy_dash/' + dashboard.id + '/';
      if (!newDashboardTitle) {
        saveModal.close();
        showModal({
          title: 'Error',
          body: 'You must pick a name for the new dashboard',
        });
        return;
      }
      data.dashboard_title = newDashboardTitle;
    }
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
          window.location = resp;
        } else {
          showModal({
            title: 'Success',
            body: 'This dashboard was saved successfully.',
          });
        }
      },
      error(error) {
        saveModal.close();
        const errorMsg = getAjaxErrorMsg(error);
        showModal({
          title: 'Error',
          body: 'Sorry, there was an error saving this dashboard: </ br>' + errorMsg,
        });
      },
    });
  }
  render() {
    return (
      <ModalTrigger
        ref={(modal) => { this.modal = modal; }}
        triggerNode={this.props.triggerNode}
        isButton
        modalTitle="Save Dashboard"
        modalBody={
          <div>
            <input
              type="radio"
              name="saveType"
              value="overwrite"
              onChange={this.handleSaveTypeChange}
              checked={this.state.saveType === 'overwrite'}
            />
            {' Overwrite Dashboard '} [{this.props.dashboard.dashboard_title}]
            <br />
            <br />
            <input
              type="radio"
              name="saveType"
              value="newDashboard"
              onChange={this.handleSaveTypeChange}
              checked={this.state.saveType === 'newDashboard'}
            />
            {' Save as: '}
            <input
              type="text"
              name="newDashName"
              placeholder="[dashboard name]"
              onFocus={this.handleNameChange}
              onChange={this.handleNameChange}
            />
          </div>
        }
        modalFooter={
          <div>
            <Button
              bsStyle="primary"
              onClick={() => { this.saveDashboard(this.state.saveType, this.state.newDashName); }}
            >
              Save
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
