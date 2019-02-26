import React from 'react';
import PropTypes from 'prop-types';
import { isDefined } from '@superset-ui/core';

const propTypes = {
  contentHeight: PropTypes.number,
  contentWidth: PropTypes.number,
  height: PropTypes.number.isRequired,
  renderContent: PropTypes.func,
  width: PropTypes.number.isRequired,
};
const defaultProps = {
  contentHeight: null,
  contentWidth: null,
  renderContent() {},
};

class ChartFrame extends React.PureComponent {
  render() {
    const { contentWidth, contentHeight, width, height, renderContent } = this.props;

    const overflowX = isDefined(contentWidth) && contentWidth > width;
    const overflowY = isDefined(contentHeight) && contentHeight > height;

    if (overflowX || overflowY) {
      return (
        <div
          style={{
            height,
            overflowX: overflowX ? 'scroll' : 'hidden',
            overflowY: overflowY ? 'scroll' : 'hidden',
            width,
          }}
        >
          {renderContent({
            height: contentHeight,
            width: contentWidth,
          })}
        </div>
      );
    }

    return renderContent({ height, width });
  }
}

ChartFrame.propTypes = propTypes;
ChartFrame.defaultProps = defaultProps;

export default ChartFrame;
