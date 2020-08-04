// @flow
/** @jsx jsx */
import {
  Component,
  type Element as ReactElement,
  type ElementRef,
  type Node,
} from 'react';
import { jsx } from '@emotion/core';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';

import {
  animatedScrollTo,
  getBoundingClientObj,
  type RectType,
  getScrollParent,
  getScrollTop,
  scrollTo,
} from '../utils';
import type {
  InnerRef,
  MenuPlacement,
  MenuPosition,
  CommonProps,
} from '../types';
import type { Theme } from '../types';

// ==============================
// Menu
// ==============================

// Get Menu Placement
// ------------------------------

type MenuState = {
  placement: 'bottom' | 'top' | null,
  maxHeight: number,
};
type PlacementArgs = {
  maxHeight: number,
  menuEl: ElementRef<*>,
  minHeight: number,
  placement: 'bottom' | 'top' | 'auto',
  shouldScroll: boolean,
  isFixedPosition: boolean,
  theme: Theme,
};

export function getMenuPlacement({
  maxHeight,
  menuEl,
  minHeight,
  placement,
  shouldScroll,
  isFixedPosition,
  theme,
}: PlacementArgs): MenuState {
  const { spacing } = theme;
  const scrollParent = getScrollParent(menuEl);
  const defaultState = { placement: 'bottom', maxHeight };

  // something went wrong, return default state
  if (!menuEl || !menuEl.offsetParent) return defaultState;

  // we can't trust `scrollParent.scrollHeight` --> it may increase when
  // the menu is rendered
  const { height: scrollHeight } = scrollParent.getBoundingClientRect();
  const {
    bottom: menuBottom,
    height: menuHeight,
    top: menuTop,
  } = menuEl.getBoundingClientRect();

  const { top: containerTop } = menuEl.offsetParent.getBoundingClientRect();
  const viewHeight = window.innerHeight;
  const scrollTop = getScrollTop(scrollParent);

  const marginBottom = parseInt(getComputedStyle(menuEl).marginBottom, 10);
  const marginTop = parseInt(getComputedStyle(menuEl).marginTop, 10);
  const viewSpaceAbove = containerTop - marginTop;
  const viewSpaceBelow = viewHeight - menuTop;
  const scrollSpaceAbove = viewSpaceAbove + scrollTop;
  const scrollSpaceBelow = scrollHeight - scrollTop - menuTop;

  const scrollDown = menuBottom - viewHeight + scrollTop + marginBottom;
  const scrollUp = scrollTop + menuTop - marginTop;
  const scrollDuration = 160;

  switch (placement) {
    case 'auto':
    case 'bottom':
      // 1: the menu will fit, do nothing
      if (viewSpaceBelow >= menuHeight) {
        return { placement: 'bottom', maxHeight };
      }

      // 2: the menu will fit, if scrolled
      if (scrollSpaceBelow >= menuHeight && !isFixedPosition) {
        if (shouldScroll) {
          animatedScrollTo(scrollParent, scrollDown, scrollDuration);
        }

        return { placement: 'bottom', maxHeight };
      }

      // 3: the menu will fit, if constrained
      if (
        (!isFixedPosition && scrollSpaceBelow >= minHeight) ||
        (isFixedPosition && viewSpaceBelow >= minHeight)
      ) {
        if (shouldScroll) {
          animatedScrollTo(scrollParent, scrollDown, scrollDuration);
        }

        // we want to provide as much of the menu as possible to the user,
        // so give them whatever is available below rather than the minHeight.
        const constrainedHeight = isFixedPosition
          ? viewSpaceBelow - marginBottom
          : scrollSpaceBelow - marginBottom;

        return {
          placement: 'bottom',
          maxHeight: constrainedHeight,
        };
      }

      // 4. Forked beviour when there isn't enough space below

      // AUTO: flip the menu, render above
      if (placement === 'auto' || isFixedPosition) {
        // may need to be constrained after flipping
        let constrainedHeight = maxHeight;
        const spaceAbove = isFixedPosition ? viewSpaceAbove : scrollSpaceAbove;

        if (spaceAbove >= minHeight) {
          constrainedHeight = Math.min(
            spaceAbove - marginBottom - spacing.controlHeight,
            maxHeight
          );
        }

        return { placement: 'top', maxHeight: constrainedHeight };
      }

      // BOTTOM: allow browser to increase scrollable area and immediately set scroll
      if (placement === 'bottom') {
        scrollTo(scrollParent, scrollDown);
        return { placement: 'bottom', maxHeight };
      }
      break;
    case 'top':
      // 1: the menu will fit, do nothing
      if (viewSpaceAbove >= menuHeight) {
        return { placement: 'top', maxHeight };
      }

      // 2: the menu will fit, if scrolled
      if (scrollSpaceAbove >= menuHeight && !isFixedPosition) {
        if (shouldScroll) {
          animatedScrollTo(scrollParent, scrollUp, scrollDuration);
        }

        return { placement: 'top', maxHeight };
      }

      // 3: the menu will fit, if constrained
      if (
        (!isFixedPosition && scrollSpaceAbove >= minHeight) ||
        (isFixedPosition && viewSpaceAbove >= minHeight)
      ) {
        let constrainedHeight = maxHeight;

        // we want to provide as much of the menu as possible to the user,
        // so give them whatever is available below rather than the minHeight.
        if (
          (!isFixedPosition && scrollSpaceAbove >= minHeight) ||
          (isFixedPosition && viewSpaceAbove >= minHeight)
        ) {
          constrainedHeight = isFixedPosition
            ? viewSpaceAbove - marginTop
            : scrollSpaceAbove - marginTop;
        }

        if (shouldScroll) {
          animatedScrollTo(scrollParent, scrollUp, scrollDuration);
        }

        return {
          placement: 'top',
          maxHeight: constrainedHeight,
        };
      }

      // 4. not enough space, the browser WILL NOT increase scrollable area when
      // absolutely positioned element rendered above the viewport (only below).
      // Flip the menu, render below
      return { placement: 'bottom', maxHeight };
    default:
      throw new Error(`Invalid placement provided "${placement}".`);
  }

  // fulfil contract with flow: implicit return value of undefined
  return defaultState;
}

// Menu Component
// ------------------------------

export type MenuAndPlacerCommon = CommonProps & {
  /** Callback to update the portal after possible flip. */
  getPortalPlacement: MenuState => void,
  /** Props to be passed to the menu wrapper. */
  innerProps: {},
  /** Set the maximum height of the menu. */
  maxMenuHeight: number,
  /** Set whether the menu should be at the top, at the bottom. The auto options sets it to bottom. */
  menuPlacement: MenuPlacement,
  /* The CSS position value of the menu, when "fixed" extra layout management is required */
  menuPosition: MenuPosition,
  /** Set the minimum height of the menu. */
  minMenuHeight: number,
  /** Set whether the page should scroll to show the menu. */
  menuShouldScrollIntoView: boolean,
};
export type MenuProps = MenuAndPlacerCommon & {
  /** Reference to the internal element, consumed by the MenuPlacer component */
  innerRef: ElementRef<*>,
  /** The children to be rendered. */
  children: ReactElement<*>,
};
export type MenuPlacerProps = MenuAndPlacerCommon & {
  /** The children to be rendered. */
  children: ({}) => Node,
};

function alignToControl(placement) {
  const placementToCSSProp = { bottom: 'top', top: 'bottom' };
  return placement ? placementToCSSProp[placement] : 'bottom';
}
const coercePlacement = p => (p === 'auto' ? 'bottom' : p);

type MenuStateWithProps = MenuState & MenuProps;

export const menuCSS = ({
  placement,
  theme: { borderRadius, spacing, colors },
}: MenuStateWithProps) => ({
  label: 'menu',
  [alignToControl(placement)]: '100%',
  backgroundColor: colors.neutral0,
  borderRadius: borderRadius,
  boxShadow: '0 0 0 1px hsla(0, 0%, 0%, 0.1), 0 4px 11px hsla(0, 0%, 0%, 0.1)',
  marginBottom: spacing.menuGutter,
  marginTop: spacing.menuGutter,
  position: 'absolute',
  width: '100%',
  zIndex: 1,
});

// NOTE: internal only
export class MenuPlacer extends Component<MenuPlacerProps, MenuState> {
  state = {
    maxHeight: this.props.maxMenuHeight,
    placement: null,
  };
  static contextTypes = {
    getPortalPlacement: PropTypes.func,
  };
  getPlacement = (ref: ElementRef<*>) => {
    const {
      minMenuHeight,
      maxMenuHeight,
      menuPlacement,
      menuPosition,
      menuShouldScrollIntoView,
      theme,
    } = this.props;
    const { getPortalPlacement } = this.context;

    if (!ref) return;

    // DO NOT scroll if position is fixed
    const isFixedPosition = menuPosition === 'fixed';
    const shouldScroll = menuShouldScrollIntoView && !isFixedPosition;

    const state = getMenuPlacement({
      maxHeight: maxMenuHeight,
      menuEl: ref,
      minHeight: minMenuHeight,
      placement: menuPlacement,
      shouldScroll,
      isFixedPosition,
      theme,
    });

    if (getPortalPlacement) getPortalPlacement(state);

    this.setState(state);
  };
  getUpdatedProps = () => {
    const { menuPlacement } = this.props;
    const placement = this.state.placement || coercePlacement(menuPlacement);

    return { ...this.props, placement, maxHeight: this.state.maxHeight };
  };
  render() {
    const { children } = this.props;

    return children({
      ref: this.getPlacement,
      placerProps: this.getUpdatedProps(),
    });
  }
}

const Menu = (props: MenuProps) => {
  const { children, className, cx, getStyles, innerRef, innerProps } = props;

  return (
    <div
      css={getStyles('menu', props)}
      className={cx({ menu: true }, className)}
      {...innerProps}
      ref={innerRef}
    >
      {children}
    </div>
  );
};

export default Menu;

// ==============================
// Menu List
// ==============================

type MenuListState = {
  /** Set classname for isMulti */
  isMulti: boolean,
  /* Set the max height of the Menu component  */
  maxHeight: number,
};

export type MenuListProps = {
  /** The children to be rendered. */
  children: Node,
  /** Inner ref to DOM Node */
  innerRef: InnerRef,
};
export type MenuListComponentProps = CommonProps &
  MenuListProps &
  MenuListState;
export const menuListCSS = ({
  maxHeight,
  theme: {
    spacing: { baseUnit },
  },
}: MenuListComponentProps) => ({
  maxHeight,
  overflowY: 'auto',
  paddingBottom: baseUnit,
  paddingTop: baseUnit,
  position: 'relative', // required for offset[Height, Top] > keyboard scroll
  WebkitOverflowScrolling: 'touch',
});
export const MenuList = (props: MenuListComponentProps) => {
  const { children, className, cx, getStyles, isMulti, innerRef } = props;
  return (
    <div
      css={getStyles('menuList', props)}
      className={cx(
        {
          'menu-list': true,
          'menu-list--is-multi': isMulti,
        },
        className
      )}
      ref={innerRef}
    >
      {children}
    </div>
  );
};

// ==============================
// Menu Notices
// ==============================

const noticeCSS = ({
  theme: {
    spacing: { baseUnit },
    colors,
  },
}: NoticeProps) => ({
  color: colors.neutral40,
  padding: `${baseUnit * 2}px ${baseUnit * 3}px`,
  textAlign: 'center',
});
export const noOptionsMessageCSS = noticeCSS;
export const loadingMessageCSS = noticeCSS;

export type NoticeProps = CommonProps & {
  /** The children to be rendered. */
  children: Node,
  /** Props to be passed on to the wrapper. */
  innerProps: {},
};

export const NoOptionsMessage = (props: NoticeProps) => {
  const { children, className, cx, getStyles, innerProps } = props;
  return (
    <div
      css={getStyles('noOptionsMessage', props)}
      className={cx(
        {
          'menu-notice': true,
          'menu-notice--no-options': true,
        },
        className
      )}
      {...innerProps}
    >
      {children}
    </div>
  );
};
NoOptionsMessage.defaultProps = {
  children: 'No options',
};

export const LoadingMessage = (props: NoticeProps) => {
  const { children, className, cx, getStyles, innerProps } = props;
  return (
    <div
      css={getStyles('loadingMessage', props)}
      className={cx(
        {
          'menu-notice': true,
          'menu-notice--loading': true,
        },
        className
      )}
      {...innerProps}
    >
      {children}
    </div>
  );
};
LoadingMessage.defaultProps = {
  children: 'Loading...',
};

// ==============================
// Menu Portal
// ==============================

export type MenuPortalProps = CommonProps & {
  appendTo: HTMLElement,
  children: Node, // ideally Menu<MenuProps>
  controlElement: HTMLElement,
  menuPlacement: MenuPlacement,
  menuPosition: MenuPosition,
};
type MenuPortalState = {
  placement: 'bottom' | 'top' | null,
};
type PortalStyleArgs = {
  offset: number,
  position: MenuPosition,
  rect: RectType,
};

export const menuPortalCSS = ({ rect, offset, position }: PortalStyleArgs) => ({
  left: rect.left,
  position: position,
  top: offset,
  width: rect.width,
  zIndex: 1,
});

export class MenuPortal extends Component<MenuPortalProps, MenuPortalState> {
  state = { placement: null };
  static childContextTypes = {
    getPortalPlacement: PropTypes.func,
  };
  getChildContext() {
    return {
      getPortalPlacement: this.getPortalPlacement,
    };
  }

  // callback for occassions where the menu must "flip"
  getPortalPlacement = ({ placement }: MenuState) => {
    const initialPlacement = coercePlacement(this.props.menuPlacement);

    // avoid re-renders if the placement has not changed
    if (placement !== initialPlacement) {
      this.setState({ placement });
    }
  };
  render() {
    const {
      appendTo,
      children,
      controlElement,
      menuPlacement,
      menuPosition: position,
      getStyles,
    } = this.props;
    const isFixed = position === 'fixed';

    // bail early if required elements aren't present
    if ((!appendTo && !isFixed) || !controlElement) {
      return null;
    }

    const placement = this.state.placement || coercePlacement(menuPlacement);
    const rect = getBoundingClientObj(controlElement);
    const scrollDistance = isFixed ? 0 : window.pageYOffset;
    const offset = rect[placement] + scrollDistance;
    const state = { offset, position, rect };

    // same wrapper element whether fixed or portalled
    const menuWrapper = (
      <div css={getStyles('menuPortal', state)}>{children}</div>
    );

    return appendTo ? createPortal(menuWrapper, appendTo) : menuWrapper;
  }
}
