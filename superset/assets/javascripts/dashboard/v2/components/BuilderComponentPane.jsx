import React from 'react';
import PropTypes from 'prop-types';

import NewChart from './gridComponents/new/NewChart';
import NewColumn from './gridComponents/new/NewColumn';
import NewDivider from './gridComponents/new/NewDivider';
import NewHeader from './gridComponents/new/NewHeader';
import NewRow from './gridComponents/new/NewRow';
import NewSpacer from './gridComponents/new/NewSpacer';
import NewTabs from './gridComponents/new/NewTabs';

const propTypes = {
  editMode: PropTypes.bool,
};

class BuilderComponentPane extends React.PureComponent {
  render() {
    return (
      <div className="dashboard-builder-sidepane">
        <div className="dashboard-builder-sidepane-header">
          Insert components
        </div>
        <NewChart />
        <NewHeader />

        <NewDivider />
        <NewSpacer />

        <NewTabs />
        <NewRow />
        <NewColumn />
      </div>
    );
  }
}

BuilderComponentPane.propTypes = propTypes;

export default BuilderComponentPane;
