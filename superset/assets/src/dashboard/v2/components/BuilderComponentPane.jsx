import React from 'react';
import cx from 'classnames';

import NewColumn from './gridComponents/new/NewColumn';
import NewDivider from './gridComponents/new/NewDivider';
import NewHeader from './gridComponents/new/NewHeader';
import NewRow from './gridComponents/new/NewRow';
import NewTabs from './gridComponents/new/NewTabs';
import SliceAdderContainer from '../../../dashboard/components/SliceAdderContainer';

class BuilderComponentPane extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      showSlices: false,
    };

    this.openSlicesPane = this.showSlices.bind(this, true);
    this.closeSlicesPane = this.showSlices.bind(this, false);
  }

  showSlices(show) {
    this.setState({
      showSlices: show,
    });
  }

  render() {
    return (
      <div className="dashboard-builder-sidepane">
        <div className="dashboard-builder-sidepane-header">
          Insert components
          {this.state.showSlices &&
            <i className="fa fa-times close trigger" onClick={this.closeSlicesPane} role="none" />}
        </div>

        <div className="component-layer">
          <div
            className="dragdroppable dragdroppable-row"
            onClick={this.openSlicesPane}
            role="none"
          >
            <div className="new-component static">
              <div className="new-component-placeholder fa fa-area-chart" />
              Chart
              <i className="fa fa-arrow-right open trigger" />
            </div>
          </div>

          <NewHeader />
          <NewDivider />
          <NewTabs />
          <NewRow />
          <NewColumn />
        </div>

        <div className={cx('slices-layer', this.state.showSlices && 'show')}>
          <SliceAdderContainer />
        </div>
      </div>
    );
  }
}

export default BuilderComponentPane;
