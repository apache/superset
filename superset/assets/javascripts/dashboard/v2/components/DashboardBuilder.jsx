import React from 'react';
import PropTypes from 'prop-types';
import HTML5Backend from 'react-dnd-html5-backend';
import { DragDropContext } from 'react-dnd';
import cx from 'classnames';

import BuilderComponentPane from './BuilderComponentPane';
import DashboardGrid from '../containers/DashboardGrid';

const propTypes = {
  editMode: PropTypes.bool,
};

const defaultProps = {
  editMode: true,
};

class DashboardBuilder extends React.Component {
  constructor(props) {
    super(props);
    // this component might control the state of the side pane etc. in the future
    this.state = {};
  }

  render() {
    return (
      <div className={cx('dashboard-builder')}>
        <DashboardGrid />
        <BuilderComponentPane />
      </div>
    );
  }
}

DashboardBuilder.propTypes = propTypes;
DashboardBuilder.defaultProps = defaultProps;

export default DragDropContext(HTML5Backend)(DashboardBuilder);
