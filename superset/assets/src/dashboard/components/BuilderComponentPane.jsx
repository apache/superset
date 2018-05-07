/* eslint-env browser */
import PropTypes from 'prop-types';
import React from 'react';
import cx from 'classnames';
import { StickyContainer, Sticky } from 'react-sticky';

import NewColumn from './gridComponents/new/NewColumn';
import NewDivider from './gridComponents/new/NewDivider';
import NewHeader from './gridComponents/new/NewHeader';
import NewRow from './gridComponents/new/NewRow';
import NewTabs from './gridComponents/new/NewTabs';
import SliceAdder from '../containers/SliceAdder';
import { t } from '../../locales';

const propTypes = {
  topOffset: PropTypes.number,
};

const defaultProps = {
  topOffset: 0,
};

class BuilderComponentPane extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      slideDirection: 'slide-out',
    };

    this.openSlicesPane = this.slide.bind(this, 'slide-in');
    this.closeSlicesPane = this.slide.bind(this, 'slide-out');
  }

  slide(direction) {
    this.setState({
      slideDirection: direction,
    });
  }

  render() {
    const { topOffset } = this.props;
    return (
      <StickyContainer className="dashboard-builder-sidepane">
        <Sticky topOffset={-topOffset}>
          {({ style, calculatedHeight, isSticky }) => (
            <div
              className="viewport"
              style={isSticky ? { ...style, top: topOffset } : null}
            >
              <div
                className={cx('slider-container', this.state.slideDirection)}
              >
                <div className="component-layer slide-content">
                  <div className="dashboard-builder-sidepane-header">
                    {t('Insert new component')}
                  </div>
                  <div
                    className="new-component static"
                    role="none"
                    onClick={this.openSlicesPane}
                  >
                    <div className="new-component-placeholder fa fa-area-chart" />
                    <div className="new-component-label">{t('Chart')}</div>

                    <i className="fa fa-arrow-right trigger" />
                  </div>

                  <div className="dashboard-builder-sidepane-header">
                    {t('Other components')}
                  </div>
                  <NewHeader />
                  <NewDivider />
                  <NewTabs />
                  <NewRow />
                  <NewColumn />
                </div>
                <div className="slices-layer slide-content">
                  <div
                    className="dashboard-builder-sidepane-header"
                    onClick={this.closeSlicesPane}
                    role="none"
                  >
                    <i className="fa fa-arrow-left trigger" />
                    {t('Add chart')}
                  </div>
                  <SliceAdder height={calculatedHeight} />
                </div>
              </div>
            </div>
          )}
        </Sticky>
      </StickyContainer>
    );
  }
}

BuilderComponentPane.propTypes = propTypes;
BuilderComponentPane.defaultProps = defaultProps;

export default BuilderComponentPane;
