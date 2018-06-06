import React from 'react';
import PropTypes from 'prop-types';

import Controls from './Controls';
import EditableTitle from '../../../../components/EditableTitle';
import Button from '../../../../components/Button';
import FaveStar from '../../../../components/FaveStar';
import InfoTooltipWithTrigger from '../../../../components/InfoTooltipWithTrigger';
import PromptV2ConversionModal from '../../PromptV2ConversionModal';
import {
  Logger,
  LOG_ACTIONS_PREVIEW_V2,
  LOG_ACTIONS_DISMISS_V2_PROMPT,
  LOG_ACTIONS_SHOW_V2_INFO_PROMPT,
} from '../../../../logger';
import { t } from '../../../../locales';

const propTypes = {
  dashboard: PropTypes.object.isRequired,
  filters: PropTypes.object.isRequired,
  userId: PropTypes.string.isRequired,
  isStarred: PropTypes.bool,
  addSlicesToDashboard: PropTypes.func,
  onSave: PropTypes.func,
  onChange: PropTypes.func,
  fetchFaveStar: PropTypes.func,
  renderSlices: PropTypes.func,
  saveFaveStar: PropTypes.func,
  serialize: PropTypes.func,
  startPeriodicRender: PropTypes.func,
  updateDashboardTitle: PropTypes.func,
  editMode: PropTypes.bool.isRequired,
  setEditMode: PropTypes.func.isRequired,
  unsavedChanges: PropTypes.bool.isRequired,
};

class Header extends React.PureComponent {
  constructor(props) {
    super(props);
    this.handleSaveTitle = this.handleSaveTitle.bind(this);
    this.toggleEditMode = this.toggleEditMode.bind(this);
    this.state = {
      showV2PromptModal: props.dashboard.promptV2Conversion,
    };
    this.toggleShowV2PromptModal = this.toggleShowV2PromptModal.bind(this);
    this.handleConvertToV2 = this.handleConvertToV2.bind(this);
  }
  handleSaveTitle(title) {
    this.props.updateDashboardTitle(title);
  }
  handleConvertToV2(editMode) {
    Logger.append(
      LOG_ACTIONS_PREVIEW_V2,
      {
        force_v2_edit: this.props.dashboard.forceV2Edit,
        edit_mode: editMode === true,
      },
      true,
    );
    const url = new URL(window.location); // eslint-disable-line
    url.searchParams.set('version', 'v2');
    if (editMode === true) url.searchParams.set('edit', true);
    window.location = url; // eslint-disable-line
  }
  toggleEditMode() {
    this.props.setEditMode(!this.props.editMode);
  }
  toggleShowV2PromptModal() {
    const nextShowModal = !this.state.showV2PromptModal;
    this.setState({ showV2PromptModal: nextShowModal });
    if (nextShowModal) {
      Logger.append(
        LOG_ACTIONS_SHOW_V2_INFO_PROMPT,
        {
          force_v2_edit: this.props.dashboard.forceV2Edit,
        },
        true,
      );
    } else {
      Logger.append(
        LOG_ACTIONS_DISMISS_V2_PROMPT,
        {
          force_v2_edit: this.props.dashboard.forceV2Edit,
        },
        true,
      );
    }
  }
  renderUnsaved() {
    if (!this.props.unsavedChanges) {
      return null;
    }
    return (
      <InfoTooltipWithTrigger
        label="unsaved"
        tooltip={t('Unsaved changes')}
        icon="exclamation-triangle"
        className="text-danger m-r-5"
        placement="top"
      />
    );
  }
  renderEditButton() {
    if (!this.props.dashboard.dash_save_perm) {
      return null;
    }
    const btnText = this.props.editMode ? 'Switch to View Mode' : 'Edit Dashboard';
    return (
      <Button
        bsStyle="default"
        className="m-r-5"
        style={{ width: '150px' }}
        onClick={this.toggleEditMode}
      >
        {btnText}
      </Button>);
  }
  render() {
    const dashboard = this.props.dashboard;
    return (
      <div className="title">
        <div className="pull-left">
          <h1 className="outer-container pull-left">
            <EditableTitle
              title={dashboard.dashboard_title}
              canEdit={dashboard.dash_save_perm && this.props.editMode}
              onSaveTitle={this.handleSaveTitle}
              showTooltip={this.props.editMode}
            />
            <span className="favstar m-l-5">
              <FaveStar
                itemId={dashboard.id}
                fetchFaveStar={this.props.fetchFaveStar}
                saveFaveStar={this.props.saveFaveStar}
                isStarred={this.props.isStarred}
              />
            </span>
            {dashboard.promptV2Conversion && (
              <span
                role="none"
                className="v2-preview-badge"
                onClick={this.toggleShowV2PromptModal}
              >
                {t('Convert to v2')}
                <span className="fa fa-info-circle m-l-5" />
              </span>
            )}
            {this.renderUnsaved()}
          </h1>
        </div>
        <div className="pull-right" style={{ marginTop: '35px' }}>
          {this.renderEditButton()}
          <Controls
            dashboard={dashboard}
            filters={this.props.filters}
            userId={this.props.userId}
            addSlicesToDashboard={this.props.addSlicesToDashboard}
            onSave={this.props.onSave}
            onChange={this.props.onChange}
            renderSlices={this.props.renderSlices}
            serialize={this.props.serialize}
            startPeriodicRender={this.props.startPeriodicRender}
            editMode={this.props.editMode}
          />
        </div>
        <div className="clearfix" />
        {this.state.showV2PromptModal &&
          dashboard.promptV2Conversion &&
          !this.props.editMode && (
            <PromptV2ConversionModal
              onClose={this.toggleShowV2PromptModal}
              handleConvertToV2={this.handleConvertToV2}
              forceV2Edit={dashboard.forceV2Edit}
              v2AutoConvertDate={dashboard.v2AutoConvertDate}
              v2FeedbackUrl={dashboard.v2FeedbackUrl}
            />
          )}
      </div>
    );
  }
}
Header.propTypes = propTypes;

export default Header;
