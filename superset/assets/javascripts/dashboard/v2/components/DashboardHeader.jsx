import React from 'react';
import PropTypes from 'prop-types';
import { ButtonToolbar, DropdownButton, MenuItem } from 'react-bootstrap';

import Button from '../../../components/Button';
import EditableTitle from '../../../components/EditableTitle';

const propTypes = {
  updateDashboardTitle: PropTypes.func,
  editMode: PropTypes.bool.isRequired,
  setEditMode: PropTypes.func.isRequired,
};

class Header extends React.Component {
  constructor(props) {
    super(props);
    this.handleSaveTitle = this.handleSaveTitle.bind(this);
    this.toggleEditMode = this.toggleEditMode.bind(this);
  }

  handleSaveTitle(title) {
    this.props.updateDashboardTitle(title);
  }

  toggleEditMode() {
    this.props.setEditMode(!this.props.editMode);
  }

  render() {
    const { editMode } = this.props;
    return (
      <div className="dashboard-header">
        <h1>
          <EditableTitle
            title={'Example header'}
            canEdit={false}
            onSaveTitle={() => {}}
            showTooltip={false}
          />
        </h1>
        <ButtonToolbar>
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

Header.propTypes = propTypes;

export default Header;
