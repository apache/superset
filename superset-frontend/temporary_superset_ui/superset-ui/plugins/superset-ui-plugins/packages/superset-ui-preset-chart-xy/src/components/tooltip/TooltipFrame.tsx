import React, { PureComponent } from 'react';

type Props = {
  className?: string;
  children: React.ReactNode;
};

const CONTAINER_STYLE = { padding: 8 };

class TooltipFrame extends PureComponent<Props, {}> {
  static defaultProps = {
    className: '',
  };

  render() {
    const { className, children } = this.props;

    return (
      <div className={className} style={CONTAINER_STYLE}>
        {children}
      </div>
    );
  }
}

export default TooltipFrame;
