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
import cx from 'classnames';

type ShouldFocusContainer = HTMLDivElement & {
  contains: (event_target: EventTarget & HTMLElement) => Boolean;
};

interface WithPopoverMenuProps {
  children: React.ReactNode;
  disableClick: Boolean;
  menuItems: React.ReactNode[];
  onChangeFocus: (focus: Boolean) => void;
  isFocused: Boolean;
  // Event argument is left as "any" because of the clash. In defaultProps it seems
  // like it should be React.FocusEvent<>, however from handleClick() we can also
  // derive that type is EventListenerOrEventListenerObject.
  shouldFocus: (event: any, container: ShouldFocusContainer) => Boolean;
  editMode: Boolean;
  style: React.CSSProperties;
}

interface WithPopoverMenuState {
  isFocused: Boolean;
}

export default class WithPopoverMenu extends React.PureComponent<
  WithPopoverMenuProps,
  WithPopoverMenuState
> {
  container: ShouldFocusContainer;

  static defaultProps = {
    children: null,
    disableClick: false,
    onChangeFocus: null,
    menuItems: [],
    isFocused: false,
    shouldFocus: (event: any, container: ShouldFocusContainer) =>
      container?.contains(event.target) ||
      event.target.id === 'menu-item' ||
      event.target.parentNode?.id === 'menu-item',
    style: null,
  };

  constructor(props: WithPopoverMenuProps) {
    super(props);
    this.state = {
      isFocused: props.isFocused!,
    };
    this.setRef = this.setRef.bind(this);
    this.handleClick = this.handleClick.bind(this);
  }

  UNSAFE_componentWillReceiveProps(nextProps: WithPopoverMenuProps) {
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

  setRef(ref: ShouldFocusContainer) {
    this.container = ref;
  }

  handleClick(event: any) {
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
        {editMode && isFocused && (menuItems?.length ?? 0) > 0 && (
          <div className="popover-menu">
            {menuItems.map((node: React.ReactNode, i: Number) => (
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
