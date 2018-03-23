import React from 'react';
import PropTypes from 'prop-types';
import { ButtonGroup, ButtonToolbar, DropdownButton, MenuItem } from 'react-bootstrap';

import Button from '../../../components/Button';
import { componentShape } from '../util/propShapes';
import EditableTitle from '../../../components/EditableTitle';

const propTypes = {
  // editMode: PropTypes.bool.isRequired,
  // setEditMode: PropTypes.func.isRequired,
  component: componentShape.isRequired,

  // redux
  updateComponents: PropTypes.func.isRequired,
  onUndo: PropTypes.func.isRequired,
  onRedo: PropTypes.func.isRequired,
  canUndo: PropTypes.bool.isRequired,
  canRedo: PropTypes.bool.isRequired,
};

class DashboardHeader extends React.Component {
  constructor(props) {
    super(props);
    this.handleChangeText = this.handleChangeText.bind(this);
    this.toggleEditMode = this.toggleEditMode.bind(this);
  }

  toggleEditMode() {
    console.log('@TODO toggleEditMode');
    // this.props.setEditMode(!this.props.editMode);
  }

  handleChangeText(nextText) {
    const { updateComponents, component } = this.props;
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
    }
  }

  render() {
    const { component, onUndo, onRedo, canUndo, canRedo } = this.props;
    const editMode = true;

    return (
      <div className="dashboard-header">
        <h1>
          <EditableTitle
            title={component.meta.text}
            onSaveTitle={this.handleChangeText}
            showTooltip={false}
            canEdit={editMode}
          />
        </h1>
        <ButtonToolbar>
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

          <DropdownButton title="Actions" bsSize="small" id="btn-dashboard-actions">
            <MenuItem>Action 1</MenuItem>
            <MenuItem>Action 2</MenuItem>
            <MenuItem>Action 3</MenuItem>
          </DropdownButton>

          <Button
            bsStyle="primary"
            onClick={this.toggleEditMode}
          >
            {editMode ? 'Save changes' : 'Edit dashboard'}
          </Button>
        </ButtonToolbar>
      </div>
    );
  }
}

DashboardHeader.propTypes = propTypes;

export default DashboardHeader;
