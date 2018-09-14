import React from 'react';

export default function reactize(renderFn) {
  class ReactifiedComponent extends React.Component {
    componentDidMount() {
      this.execute();
    }

    componentDidUpdate() {
      this.execute();
    }

    componentWillUnmount() {
      this.container = null;
    }

    execute() {
      if (this.container) {
        renderFn(this.container, this.props);
      }
    }

    render() {
      const { id, className } = this.props;
      return (
        <div
          id={id}
          className={className}
          ref={(c) => { this.container = c; }}
        />
      );
    }
  }

  if (renderFn.propTypes) {
    ReactifiedComponent.propTypes = renderFn.propTypes;
  }
  if (renderFn.defaultProps) {
    ReactifiedComponent.defaultProps = renderFn.defaultProps;
  }
  return ReactifiedComponent;
}
