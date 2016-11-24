import React from 'react';

import Controls from './Controls';

const propTypes = {
  dashboard: React.PropTypes.object,
};
const defaultProps = {
};

class Header extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
    };
  }
  render() {
    const dashboard = this.props.dashboard;
    return (
      <div className="title">
        <div className="pull-left">
          <h1>
            {dashboard.dashboard_title} &nbsp;
            <span is class="favstar" class_name="Dashboard" obj_id={dashboard.id} />
          </h1>
        </div>
        <div className="pull-right">
        {!this.props.dashboard.context.standalone_mode &&
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
