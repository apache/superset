import React from 'react';

export default function VirtualizedRendererWrap(renderer) {
  function wrapperRenderer({
    focusedOption,
    focusedOptionIndex,
    focusOption,
    key,
    labelKey,
    option,
    options,
    selectValue,
    style,
    valueArray,
  }) {
    if (!option) {
      return;
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
        style={style}
        title={option.title}
        {...events}
      >
        {renderer(option)}
      </div>
    )
  }
  return wrapperRenderer;
}
