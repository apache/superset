// @flow

import React, { Component, type Element } from 'react';

import NodeResolver from './NodeResolver';

export type CaptorProps = {
  children: Element<*>,
  onBottomArrive?: (event: SyntheticEvent<HTMLElement>) => void,
  onBottomLeave?: (event: SyntheticEvent<HTMLElement>) => void,
  onTopArrive?: (event: SyntheticEvent<HTMLElement>) => void,
  onTopLeave?: (event: SyntheticEvent<HTMLElement>) => void,
};

class ScrollCaptor extends Component<CaptorProps> {
  isBottom: boolean = false;
  isTop: boolean = false;
  scrollTarget: HTMLElement;
  touchStart: number;

  componentDidMount() {
    this.startListening(this.scrollTarget);
  }
  componentWillUnmount() {
    this.stopListening(this.scrollTarget);
  }
  startListening(el: HTMLElement) {
    // bail early if no element is available to attach to
    if (!el) return;

    // all the if statements are to appease Flow 😢
    if (typeof el.addEventListener === 'function') {
      el.addEventListener('wheel', this.onWheel, false);
    }
    if (typeof el.addEventListener === 'function') {
      el.addEventListener('touchstart', this.onTouchStart, false);
    }
    if (typeof el.addEventListener === 'function') {
      el.addEventListener('touchmove', this.onTouchMove, false);
    }
  }
  stopListening(el: HTMLElement) {
    // all the if statements are to appease Flow 😢
    if (typeof el.removeEventListener === 'function') {
      el.removeEventListener('wheel', this.onWheel, false);
    }
    if (typeof el.removeEventListener === 'function') {
      el.removeEventListener('touchstart', this.onTouchStart, false);
    }
    if (typeof el.removeEventListener === 'function') {
      el.removeEventListener('touchmove', this.onTouchMove, false);
    }
  }

  cancelScroll = (event: SyntheticEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };
  handleEventDelta = (event: SyntheticEvent<HTMLElement>, delta: number) => {
    const {
      onBottomArrive,
      onBottomLeave,
      onTopArrive,
      onTopLeave,
    } = this.props;
    const { scrollTop, scrollHeight, clientHeight } = this.scrollTarget;
    const target = this.scrollTarget;
    const isDeltaPositive = delta > 0;
    const availableScroll = scrollHeight - clientHeight - scrollTop;
    let shouldCancelScroll = false;

    // reset bottom/top flags
    if (availableScroll > delta && this.isBottom) {
      if (onBottomLeave) onBottomLeave(event);
      this.isBottom = false;
    }
    if (isDeltaPositive && this.isTop) {
      if (onTopLeave) onTopLeave(event);
      this.isTop = false;
    }

    // bottom limit
    if (isDeltaPositive && delta > availableScroll) {
      if (onBottomArrive && !this.isBottom) {
        onBottomArrive(event);
      }
      target.scrollTop = scrollHeight;
      shouldCancelScroll = true;
      this.isBottom = true;

      // top limit
    } else if (!isDeltaPositive && -delta > scrollTop) {
      if (onTopArrive && !this.isTop) {
        onTopArrive(event);
      }
      target.scrollTop = 0;
      shouldCancelScroll = true;
      this.isTop = true;
    }

    // cancel scroll
    if (shouldCancelScroll) {
      this.cancelScroll(event);
    }
  };

  onWheel = (event: SyntheticWheelEvent<HTMLElement>) => {
    this.handleEventDelta(event, event.deltaY);
  };
  onTouchStart = (event: SyntheticTouchEvent<HTMLElement>) => {
    // set touch start so we can calculate touchmove delta
    this.touchStart = event.changedTouches[0].clientY;
  };
  onTouchMove = (event: SyntheticTouchEvent<HTMLElement>) => {
    const deltaY = this.touchStart - event.changedTouches[0].clientY;
    this.handleEventDelta(event, deltaY);
  };

  getScrollTarget = (ref: HTMLElement) => {
    this.scrollTarget = ref;
  };

  render() {
    return (
      <NodeResolver innerRef={this.getScrollTarget}>
        {this.props.children}
      </NodeResolver>
    );
  }
}

type SwitchProps = CaptorProps & {
  isEnabled: boolean,
};

export default function ScrollCaptorSwitch({
  isEnabled = true,
  ...props
}: SwitchProps) {
  return isEnabled ? <ScrollCaptor {...props} /> : props.children;
}
