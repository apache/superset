import React from 'react';
import PropTypes from 'prop-types';

export default function reactize(renderFn) {
  const propTypes = {
    id: PropTypes.string,
    className: PropTypes.string,
    formData: PropTypes.object,
    setControlValue: PropTypes.func,
  };
  const defaultProps = {
    id: null,
    className: '',
    formData: {},
    setControlValue() {},
  };

  class Visualization extends React.Component {
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
        const { formData, setControlValue } = this.props;
        renderFn(this.container, formData, setControlValue);
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

  Visualization.propTypes = propTypes;
  Visualization.defaultProps = defaultProps;

  return Visualization;
}
