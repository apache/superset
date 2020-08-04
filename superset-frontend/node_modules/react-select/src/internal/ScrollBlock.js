// @flow
/** @jsx jsx */
import { PureComponent, type Element } from 'react';
import { jsx } from '@emotion/core';
import NodeResolver from './NodeResolver';
import ScrollLock from './ScrollLock/index';

type Props = {
  children: Element<*>,
  isEnabled: boolean,
};
type State = {
  touchScrollTarget: HTMLElement | null,
};

// NOTE:
// We shouldn't need this after updating to React v16.3.0, which introduces:
// - createRef() https://reactjs.org/docs/react-api.html#reactcreateref
// - forwardRef() https://reactjs.org/docs/react-api.html#reactforwardref

export default class ScrollBlock extends PureComponent<Props, State> {
  state = { touchScrollTarget: null };

  // must be in state to trigger a re-render, only runs once per instance
  getScrollTarget = (ref: HTMLElement) => {
    if (ref === this.state.touchScrollTarget) return;
    this.setState({ touchScrollTarget: ref });
  };

  // this will close the menu when a user clicks outside
  blurSelectInput = () => {
    if (document.activeElement) {
      document.activeElement.blur();
    }
  };

  render() {
    const { children, isEnabled } = this.props;
    const { touchScrollTarget } = this.state;

    // bail early if not enabled
    if (!isEnabled) return children;

    /*
     * Div
     * ------------------------------
     * blocks scrolling on non-body elements behind the menu

     * NodeResolver
     * ------------------------------
     * we need a reference to the scrollable element to "unlock" scroll on
     * mobile devices

     * ScrollLock
     * ------------------------------
     * actually does the scroll locking
     */
    return (
      <div>
        <div
          onClick={this.blurSelectInput}
          css={{ position: 'fixed', left: 0, bottom: 0, right: 0, top: 0 }}
        />
        <NodeResolver innerRef={this.getScrollTarget}>{children}</NodeResolver>
        {touchScrollTarget ? (
          <ScrollLock touchScrollTarget={touchScrollTarget} />
        ) : null}
      </div>
    );
  }
}
