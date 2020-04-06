/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
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
    const events = option.disabled
      ? {}
      : {
          onClick: () => selectValue(option),
          onMouseEnter: () => focusOption(option),
        };
    return (
      <div
        className={className.join(' ')}
        key={key}
        style={{ ...(option.style || {}), ...style }}
        title={option.title}
        data-test={option.optionName}
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
