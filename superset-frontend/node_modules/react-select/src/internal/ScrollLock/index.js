// @flow
import { Component } from 'react';

import { LOCK_STYLES, STYLE_KEYS } from './constants';
import {
  allowTouchMove,
  isTouchDevice,
  preventInertiaScroll,
  preventTouchMove,
} from './utils';

const canUseDOM = !!(
  typeof window !== 'undefined' &&
  window.document &&
  window.document.createElement
);

let activeScrollLocks = 0;

type Props = {
  accountForScrollbars: boolean,
  touchScrollTarget?: HTMLElement,
};
type TargetStyle = {
  [key: string]: string | null,
};

export default class ScrollLock extends Component<Props> {
  originalStyles = {};
  listenerOptions = {
    capture: false,
    passive: false,
  };
  static defaultProps = {
    accountForScrollbars: true,
  };
  componentDidMount() {
    if (!canUseDOM) return;

    const { accountForScrollbars, touchScrollTarget } = this.props;
    const target = document.body;
    const targetStyle = target && (target.style: TargetStyle);

    if (accountForScrollbars) {
      // store any styles already applied to the body
      STYLE_KEYS.forEach(key => {
        const val = targetStyle && targetStyle[key];
        this.originalStyles[key] = val;
      });
    }

    // apply the lock styles and padding if this is the first scroll lock
    if (accountForScrollbars && activeScrollLocks < 1) {
      const currentPadding =
        parseInt(this.originalStyles.paddingRight, 10) || 0;
      const clientWidth = document.body ? document.body.clientWidth : 0;
      const adjustedPadding =
        window.innerWidth - clientWidth + currentPadding || 0;

      Object.keys(LOCK_STYLES).forEach(key => {
        const val = LOCK_STYLES[key];
        if (targetStyle) {
          targetStyle[key] = val;
        }
      });

      if (targetStyle) {
        targetStyle.paddingRight = `${adjustedPadding}px`;
      }
    }

    // account for touch devices
    if (target && isTouchDevice()) {
      // Mobile Safari ignores { overflow: hidden } declaration on the body.
      target.addEventListener(
        'touchmove',
        preventTouchMove,
        this.listenerOptions
      );

      // Allow scroll on provided target
      if (touchScrollTarget) {
        touchScrollTarget.addEventListener(
          'touchstart',
          preventInertiaScroll,
          this.listenerOptions
        );
        touchScrollTarget.addEventListener(
          'touchmove',
          allowTouchMove,
          this.listenerOptions
        );
      }
    }

    // increment active scroll locks
    activeScrollLocks += 1;
  }
  componentWillUnmount() {
    if (!canUseDOM) return;

    const { accountForScrollbars, touchScrollTarget } = this.props;
    const target = document.body;
    const targetStyle = target && (target.style: TargetStyle);

    // safely decrement active scroll locks
    activeScrollLocks = Math.max(activeScrollLocks - 1, 0);

    // reapply original body styles, if any
    if (accountForScrollbars && activeScrollLocks < 1) {
      STYLE_KEYS.forEach(key => {
        const val = this.originalStyles[key];
        if (targetStyle) {
          targetStyle[key] = val;
        }
      });
    }

    // remove touch listeners
    if (target && isTouchDevice()) {
      target.removeEventListener(
        'touchmove',
        preventTouchMove,
        this.listenerOptions
      );

      if (touchScrollTarget) {
        touchScrollTarget.removeEventListener(
          'touchstart',
          preventInertiaScroll,
          this.listenerOptions
        );
        touchScrollTarget.removeEventListener(
          'touchmove',
          allowTouchMove,
          this.listenerOptions
        );
      }
    }
  }
  render() {
    return null;
  }
}
