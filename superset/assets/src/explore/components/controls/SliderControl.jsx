import React from 'react';
import PropTypes from 'prop-types';

import BootstrapSliderWrapper from '../../../components/BootstrapSliderWrapper';
import ControlHeader from '../ControlHeader';

const propTypes = {
  onChange: PropTypes.func,
  value: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.number,
  ]),
};

const defaultProps = {
  onChange: () => {},
};

export default function SliderControl(props) {
  // This wouldn't be necessary but might as well
  return (
    <div>
      <ControlHeader {...props} />
      <BootstrapSliderWrapper
        {...props}
        change={(obj) => {
          props.onChange(obj.target.value);
        }}
      />
    </div>
  );
}

SliderControl.propTypes = propTypes;
SliderControl.defaultProps = defaultProps;
