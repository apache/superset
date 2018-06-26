/* eslint-env browser */
import PropTypes from 'prop-types';
import React from 'react';
import cx from 'classnames';
import { StickyContainer, Sticky } from 'react-sticky';
import ParentSize from '@vx/responsive/build/components/ParentSize';

import NewColumn from './gridComponents/new/NewColumn';
import NewDivider from './gridComponents/new/NewDivider';
import NewHeader from './gridComponents/new/NewHeader';
import NewRow from './gridComponents/new/NewRow';
import NewTabs from './gridComponents/new/NewTabs';
import NewMarkdown from './gridComponents/new/NewMarkdown';
import SliceAdder from '../containers/SliceAdder';
import { t } from '../../locales';

const SUPERSET_HEADER_HEIGHT = 59;

const propTypes = {
  topOffset: PropTypes.number,
  toggleBuilderPane: PropTypes.func.isRequired,
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
      <div
        className="dashboard-builder-sidepane"
        style={{
          height: `calc(100vh - ${topOffset + SUPERSET_HEADER_HEIGHT}px)`,
        }}
      >
        <ParentSize>
          {({ height }) => (
            <StickyContainer>
              <Sticky topOffset={-topOffset} bottomOffset={Infinity}>
                {({ style, isSticky }) => (
                  <div
                    className="viewport"
                    style={isSticky ? { ...style, top: topOffset } : null}
                  >
                    <div
                      className={cx(
                        'slider-container',
                        this.state.slideDirection,
                      )}
                    >
                      <div className="component-layer slide-content">
                        <div className="dashboard-builder-sidepane-header">
                          <span>{t('Insert')}</span>
                          <i
                            className="fa fa-times trigger"
                            onClick={this.props.toggleBuilderPane}
                            role="none"
                          />
                        </div>
                        <div
                          className="new-component static"
                          role="none"
                          onClick={this.openSlicesPane}
                        >
                          <div className="new-component-placeholder fa fa-area-chart" />
                          <div className="new-component-label">
                            {t('Your charts & filters')}
                          </div>

                          <i className="fa fa-arrow-right trigger" />
                        </div>
                        <NewTabs />
                        <NewRow />
                        <NewColumn />
                        <NewHeader />
                        <NewMarkdown />
                        <NewDivider />
                      </div>
                      <div className="slices-layer slide-content">
                        <div
                          className="dashboard-builder-sidepane-header"
                          onClick={this.closeSlicesPane}
                          role="none"
                        >
                          <i className="fa fa-arrow-left trigger" />
                          <span>{t('All components')}</span>
                        </div>
                        <SliceAdder
                          height={
                            height + (isSticky ? SUPERSET_HEADER_HEIGHT : 0)
                          }
                        />
                      </div>
                    </div>
                  </div>
                )}
              </Sticky>
            </StickyContainer>
          )}
        </ParentSize>
      </div>
    );
  }
}

BuilderComponentPane.propTypes = propTypes;
BuilderComponentPane.defaultProps = defaultProps;

export default BuilderComponentPane;
