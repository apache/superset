import React, { PureComponent } from 'react';

const defaultProps = {
  className: '',
};

type Props = {
  className?: string;
  children: React.ReactNode;
} & Readonly<typeof defaultProps>;

const CONTAINER_STYLE = { padding: 8 };

class TooltipFrame extends PureComponent<Props, {}> {
  static defaultProps = defaultProps;

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
