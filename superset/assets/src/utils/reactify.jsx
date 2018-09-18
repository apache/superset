import React from 'react';

export default function reactify(renderFn) {
  class ReactifiedComponent extends React.Component {
    constructor(props) {
      super(props);
      this.setContainerRef = this.setContainerRef.bind(this);
    }

    componentDidMount() {
      this.execute();
    }

    componentDidUpdate() {
      this.execute();
    }

    componentWillUnmount() {
      this.container = null;
    }

    setContainerRef(c) {
      this.container = c;
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
          ref={this.setContainerRef}
        />
      );
    }
  }

  if (renderFn.displayName) {
    ReactifiedComponent.displayName = renderFn.displayName;
  }
  if (renderFn.propTypes) {
    ReactifiedComponent.propTypes = renderFn.propTypes;
  }
  if (renderFn.defaultProps) {
    ReactifiedComponent.defaultProps = renderFn.defaultProps;
  }
  return ReactifiedComponent;
}
