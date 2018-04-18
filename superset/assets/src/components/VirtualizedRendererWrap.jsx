import React from 'react';
import PropTypes from 'prop-types';

export default function VirtualizedRendererWrap(renderer) {
  function WrapperRenderer({
    focusedOption,
    focusOption,
    key,
    option,
    selectValue,
    style,
    valueArray,
  }) {
    if (!option) {
      return null;
    }
    const className = ['VirtualizedSelectOption'];
    if (option === focusedOption) {
      className.push('VirtualizedSelectFocusedOption');
    }
    if (option.disabled) {
      className.push('VirtualizedSelectDisabledOption');
    }
    if (valueArray && valueArray.indexOf(option) >= 0) {
      className.push('VirtualizedSelectSelectedOption');
    }
    if (option.className) {
      className.push(option.className);
    }
    const events = option.disabled ? {} : {
      onClick: () => selectValue(option),
      onMouseEnter: () => focusOption(option),
    };
    return (
      <div
        className={className.join(' ')}
        key={key}
        style={Object.assign(option.style || {}, style)}
        title={option.title}
        {...events}
      >
        {renderer(option)}
      </div>
    );
  }
  WrapperRenderer.propTypes = {
    focusedOption: PropTypes.object.isRequired,
    focusOption: PropTypes.func.isRequired,
    key: PropTypes.string,
    option: PropTypes.object,
    selectValue: PropTypes.func.isRequired,
    style: PropTypes.object,
    valueArray: PropTypes.array,
  };
  return WrapperRenderer;
}
