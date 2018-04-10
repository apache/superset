import React from 'react';
import PropTypes from 'prop-types';
import { ButtonGroup } from 'react-bootstrap';

import { componentShape } from '../v2/util/propShapes';
import Controls from './Controls';
import EditableTitle from '../../components/EditableTitle';
import Button from '../../components/Button';
import FaveStar from '../../components/FaveStar';
import InfoTooltipWithTrigger from '../../components/InfoTooltipWithTrigger';
import { t } from '../../locales';

const propTypes = {
  dashboard: PropTypes.object.isRequired,
  layout: PropTypes.object.isRequired,
  filters: PropTypes.object.isRequired,
  userId: PropTypes.string.isRequired,
  isStarred: PropTypes.bool.isRequired,
  onSave: PropTypes.func.isRequired,
  onChange: PropTypes.func.isRequired,
  fetchFaveStar: PropTypes.func,
  fetchCharts: PropTypes.func.isRequired,
  saveFaveStar: PropTypes.func,
  startPeriodicRender: PropTypes.func.isRequired,
  updateDashboardTitle: PropTypes.func.isRequired,
  editMode: PropTypes.bool.isRequired,
  setEditMode: PropTypes.func.isRequired,
  showBuilderPane: PropTypes.bool,
  toggleBuilderPane: PropTypes.func.isRequired,
  hasUnsavedChanges: PropTypes.bool.isRequired,
  component: componentShape.isRequired,

  // redux
  updateComponents: PropTypes.func.isRequired,
  onUndo: PropTypes.func.isRequired,
  onRedo: PropTypes.func.isRequired,
  canUndo: PropTypes.bool.isRequired,
  canRedo: PropTypes.bool.isRequired,
};

class Header extends React.PureComponent {
  constructor(props) {
    super(props);
    this.handleChangeText = this.handleChangeText.bind(this);
    this.toggleEditMode = this.toggleEditMode.bind(this);
    this.forceRefresh = this.forceRefresh.bind(this);
  }
  forceRefresh() {
    return this.props.fetchCharts(Object.values(this.props.charts), true);
  }
  handleChangeText(nextText) {
    const { updateComponents, component, updateDashboardTitle, onChange } = this.props;
    if (nextText && component.meta.text !== nextText) {
      updateComponents({
        [component.id]: {
          ...component,
          meta: {
            ...component.meta,
            text: nextText,
          },
        },
      });
      updateDashboardTitle(nextText);
      onChange();
    }
  }
  toggleEditMode() {
    this.props.setEditMode(!this.props.editMode);
  }
  renderUnsaved() {
    if (!this.props.hasUnsavedChanges) {
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
  renderInsertButton() {
    if (!this.props.editMode) {
      return null;
    }
    const btnText = this.props.showBuilderPane ? t('Hide builder pane') : t('Insert components');
    return (
      <Button
        bsStyle="default"
        className="m-r-5"
        style={{ width: '150px' }}
        onClick={this.props.toggleBuilderPane}
      >
        {btnText}
      </Button>
    );
  }
  renderEditButton() {
    if (!this.props.dashboard.dash_save_perm) {
      return null;
    }
    const btnText = this.props.editMode ? t('Switch to View Mode') : t('Edit Dashboard');
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
    const {
      dashboard, layout, filters, userId,
      component, onUndo, onRedo, canUndo, canRedo,
      onChange, onSave, editMode,
    } = this.props;

    return (
      <div className="title">
        <div className="pull-left">
          <h1 className="outer-container pull-left">
            <EditableTitle
              title={component.meta.text}
              canEdit={dashboard.dash_save_perm && editMode}
              onSaveTitle={this.handleChangeText}
              showTooltip={false}
            />
            <span className="favstar m-r-5">
              <FaveStar
                itemId={dashboard.id}
                fetchFaveStar={this.props.fetchFaveStar}
                saveFaveStar={this.props.saveFaveStar}
                isStarred={this.props.isStarred}
              />
            </span>
            {this.renderUnsaved()}
          </h1>
        </div>
        <div className="pull-right" style={{ marginTop: '35px' }}>
          <ButtonGroup>
            <Button
              bsSize="small"
              onClick={onUndo}
              disabled={!canUndo}
            >
              Undo
            </Button>
            <Button
              bsSize="small"
              onClick={onRedo}
              disabled={!canRedo}
            >
              Redo
            </Button>
          </ButtonGroup>
          {this.renderInsertButton()}
          {this.renderEditButton()}
          <Controls
            dashboard={dashboard}
            layout={layout}
            filters={filters}
            userId={userId}
            onSave={onSave}
            onChange={onChange}
            forceRefreshAllCharts={this.forceRefresh}
            startPeriodicRender={this.props.startPeriodicRender}
            editMode={editMode}
          />
        </div>
        <div className="clearfix" />
      </div>
    );
  }
}
Header.propTypes = propTypes;

export default Header;
