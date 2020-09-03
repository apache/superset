import React, { PureComponent } from 'react';
import { isDefined } from '../utils';

function checkNumber(input: unknown): input is number {
  return isDefined(input) && typeof input === 'number';
}

type Props = {
  contentWidth?: number;
  contentHeight?: number;
  height: number;
  renderContent: ({ height, width }: { height: number; width: number }) => React.ReactNode;
  width: number;
};

export default class ChartFrame extends PureComponent<Props, {}> {
  static defaultProps = {
    renderContent() {},
  };

  render() {
    const { contentWidth, contentHeight, width, height, renderContent } = this.props;

    const overflowX = checkNumber(contentWidth) && contentWidth > width;
    const overflowY = checkNumber(contentHeight) && contentHeight > height;

    if (overflowX || overflowY) {
      return (
        <div
          style={{
            height,
            overflowX: overflowX ? 'auto' : 'hidden',
            overflowY: overflowY ? 'auto' : 'hidden',
            width,
          }}
        >
          {renderContent({
            height: Math.max(contentHeight ?? 0, height),
            width: Math.max(contentWidth ?? 0, width),
          })}
        </div>
      );
    }

    return renderContent({ height, width });
  }
}
