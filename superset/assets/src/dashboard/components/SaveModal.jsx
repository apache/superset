/* eslint-env browser */
import React from 'react';
import PropTypes from 'prop-types';

import { Button, FormControl, FormGroup, Radio } from 'react-bootstrap';
import ModalTrigger from '../../components/ModalTrigger';
import { t } from '../../locales';
import Checkbox from '../../components/Checkbox';
import { SAVE_TYPE_OVERWRITE, SAVE_TYPE_NEWDASHBOARD } from '../util/constants';

const propTypes = {
  addSuccessToast: PropTypes.func.isRequired,
  addDangerToast: PropTypes.func.isRequired,
  dashboardId: PropTypes.number.isRequired,
  dashboardTitle: PropTypes.string.isRequired,
  expandedSlices: PropTypes.object.isRequired,
  layout: PropTypes.object.isRequired,
  saveType: PropTypes.oneOf([SAVE_TYPE_OVERWRITE, SAVE_TYPE_NEWDASHBOARD]),
  triggerNode: PropTypes.node.isRequired,
  filters: PropTypes.object.isRequired,
  css: PropTypes.string.isRequired,
  onSave: PropTypes.func.isRequired,
  isMenuItem: PropTypes.bool,
  canOverwrite: PropTypes.bool.isRequired,
  isV2Preview: PropTypes.bool.isRequired,
};

const defaultProps = {
  isMenuItem: false,
  saveType: SAVE_TYPE_OVERWRITE,
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
      layout: positions,
      css,
      expandedSlices,
      filters,
      dashboardId,
    } = this.props;

    const data = {
      positions,
      css,
      expanded_slices: expandedSlices,
      dashboard_title:
        saveType === SAVE_TYPE_NEWDASHBOARD ? newDashName : dashboardTitle,
      default_filters: JSON.stringify(filters),
      duplicate_slices: this.state.duplicateSlices,
    };

    if (saveType === SAVE_TYPE_NEWDASHBOARD && !newDashName) {
      this.props.addDangerToast(
        t('You must pick a name for the new dashboard'),
      );
    } else {
      this.onSave(data, dashboardId, saveType).done(resp => {
        if (saveType === SAVE_TYPE_NEWDASHBOARD) {
          window.location = `/superset/dashboard/${resp.id}/`;
        }
      });
      this.modal.close();
    }
  }

  render() {
    const { isV2Preview } = this.props;
    return (
      <ModalTrigger
        ref={this.setModalRef}
        isMenuItem={this.props.isMenuItem}
        triggerNode={this.props.triggerNode}
        modalTitle={t(
          'Save Dashboard%s',
          isV2Preview ? ' (⚠️ all saved dashboards will be V2)' : '',
        )}
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
              <span className="m-l-5">also copy (duplicate) charts</span>
            </div>
          </FormGroup>
        }
        modalFooter={
          <div>
            <Button bsStyle="primary" onClick={this.saveDashboard}>
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
