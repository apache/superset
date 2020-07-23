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
import cx from 'classnames';

const propTypes = {
  children: PropTypes.node,
  disableClick: PropTypes.bool,
  menuItems: PropTypes.arrayOf(PropTypes.node),
  onChangeFocus: PropTypes.func,
  isFocused: PropTypes.bool,
  shouldFocus: PropTypes.func,
  editMode: PropTypes.bool.isRequired,
  style: PropTypes.object,
};

const defaultProps = {
  children: null,
  disableClick: false,
  onChangeFocus: null,
  onPressDelete() {},
  menuItems: [],
  isFocused: false,
  shouldFocus: (event, container) =>
    container && container.contains(event.target),
  style: null,
};

class WithPopoverMenu extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      isFocused: props.isFocused,
    };
    this.setRef = this.setRef.bind(this);
    this.handleClick = this.handleClick.bind(this);
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    if (nextProps.editMode && nextProps.isFocused && !this.state.isFocused) {
      document.addEventListener('click', this.handleClick);
      document.addEventListener('drag', this.handleClick);
      this.setState({ isFocused: true });
    } else if (this.state.isFocused && !nextProps.editMode) {
      document.removeEventListener('click', this.handleClick);
      document.removeEventListener('drag', this.handleClick);
      this.setState({ isFocused: false });
    }
  }

  componentWillUnmount() {
    document.removeEventListener('click', this.handleClick);
    document.removeEventListener('drag', this.handleClick);
  }

  setRef(ref) {
    this.container = ref;
  }

  handleClick(event) {
    if (!this.props.editMode) {
      return;
    }
    const {
      onChangeFocus,
      shouldFocus: shouldFocusFunc,
      disableClick,
    } = this.props;
    const shouldFocus = shouldFocusFunc(event, this.container);

    if (!disableClick && shouldFocus && !this.state.isFocused) {
      // if not focused, set focus and add a window event listener to capture outside clicks
      // this enables us to not set a click listener for ever item on a dashboard
      document.addEventListener('click', this.handleClick);
      document.addEventListener('drag', this.handleClick);
      this.setState(() => ({ isFocused: true }));
      if (onChangeFocus) {
        onChangeFocus(true);
      }
    } else if (!shouldFocus && this.state.isFocused) {
      document.removeEventListener('click', this.handleClick);
      document.removeEventListener('drag', this.handleClick);
      this.setState(() => ({ isFocused: false }));
      if (onChangeFocus) {
        onChangeFocus(false);
      }
    }
  }

  render() {
    const { children, menuItems, editMode, style } = this.props;
    const { isFocused } = this.state;

    return (
      <div
        ref={this.setRef}
        onClick={this.handleClick}
        role="none"
        className={cx(
          'with-popover-menu',
          editMode && isFocused && 'with-popover-menu--focused',
        )}
        style={style}
      >
        {children}
        {editMode && isFocused && menuItems.length > 0 && (
          <div className="popover-menu">
            {menuItems.map((node, i) => (
              <div className="menu-item" key={`menu-item-${i}`}>
                {node}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }
}

WithPopoverMenu.propTypes = propTypes;
WithPopoverMenu.defaultProps = defaultProps;

export default WithPopoverMenu;
