import React from 'react';
import PropTypes from 'prop-types';

import Controls from './Controls';
import EditableTitle from '../../components/EditableTitle';

const propTypes = {
  dashboard: PropTypes.object,
};
const defaultProps = {
};

class Header extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
    };
    this.handleSaveTitle = this.handleSaveTitle.bind(this);
  }
  handleSaveTitle(title) {
    this.props.dashboard.updateDashboardTitle(title);
  }
  render() {
    const dashboard = this.props.dashboard;
    return (
      <div className="title">
        <div className="pull-left">
          <h1 className="outer-container">
            <EditableTitle
              title={dashboard.dashboard_title}
              canEdit={dashboard.dash_save_perm}
              onSaveTitle={this.handleSaveTitle}
              noPermitTooltip={'You don\'t have the rights to alter this dashboard.'}
            />
            <span is class="favstar" class_name="Dashboard" obj_id={dashboard.id} />
          </h1>
        </div>
        <div className="pull-right" style={{ marginTop: '35px' }}>
          {!this.props.dashboard.standalone_mode &&
          <Controls dashboard={dashboard} />
        }
        </div>
        <div className="clearfix" />
      </div>
    );
  }
}
Header.propTypes = propTypes;
Header.defaultProps = defaultProps;

export default Header;
