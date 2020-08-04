import {
  Component,
  ReactElement,
  Ref as ElementRef,
  ReactNode,
  ComponentType
} from 'react';
import { createPortal } from 'react-dom';

import {
  animatedScrollTo,
  getBoundingClientObj,
  RectType,
  getScrollParent,
  getScrollTop,
  scrollTo,
} from '../utils';
import { borderRadius, colors, spacing } from '../theme';
import {
  InnerRef,
  MenuPlacement,
  MenuPosition,
  CommonProps,
  OptionTypeBase,
} from '../types';

// ==============================
// Menu
// ==============================

// Get Menu Placement
// ------------------------------

export interface MenuState { placement: 'bottom' | 'top' | null; maxHeight: number; }
export interface PlacementArgs {
  maxHeight: number;
  menuEl: ElementRef<any>;
  minHeight: number;
  placement: 'bottom' | 'top' | 'auto';
  shouldScroll: boolean;
  isFixedPosition: boolean;
}

export function getMenuPlacement(args: PlacementArgs): MenuState;

// Menu Component
// ------------------------------

export type MenuProps<OptionType extends OptionTypeBase> = CommonProps<OptionType> & {
  /** The children to be rendered. */
  children: ReactElement,
  /** Callback to update the portal after possible flip. */
  getPortalPlacement: (state: MenuState) => void,
  /** Props to be passed to the menu wrapper. */
  innerProps: object,
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

export function menuCSS(state: MenuState): React.CSSProperties;

export class Menu<OptionType extends OptionTypeBase> extends Component<MenuProps<OptionType>, MenuState> {
  static contextTypes: {
    getPortalPlacement: (state: MenuState) => void,
  };
  getPlacement: (ref: ElementRef<any>) => void;
  getState: () => MenuProps<OptionType> & MenuState;
}

export default Menu;

// ==============================
// Menu List
// ==============================

interface MenuListState {
  /** Set classname for isMulti */
  isMulti: boolean;
  /* Set the max height of the Menu component  */
  maxHeight: number;
}

export interface MenuListProps {
  /** The children to be rendered. */
  children: ReactNode;
  /** Inner ref to DOM Node */
  innerRef: InnerRef;
}
export type MenuListComponentProps<OptionType extends OptionTypeBase> = CommonProps<OptionType> &
  MenuListProps &
  MenuListState;
export function menuListCSS(state: MenuState): React.CSSProperties;
export const MenuList: ComponentType<MenuListComponentProps<any>>;

// ==============================
// Menu Notices
// ==============================

export function noOptionsMessageCSS(): React.CSSProperties;
export function loadingMessageCSS(): React.CSSProperties;

export type NoticeProps<OptionType extends OptionTypeBase> = CommonProps<OptionType> & {
  /** The children to be rendered. */
  children: ReactNode,
  /** Props to be passed on to the wrapper. */
  innerProps: { [key: string]: any },
};

export const NoOptionsMessage: ComponentType<NoticeProps<any>>;
// NoOptionsMessage.defaultProps = {
//   children: 'No options',
// };

export const LoadingMessage: ComponentType<NoticeProps<any>>;
// LoadingMessage.defaultProps = {
//   children: 'Loading...',
// };

// ==============================
// Menu Portal
// ==============================

export type MenuPortalProps<OptionType extends OptionTypeBase> = CommonProps<OptionType> & {
  appendTo: HTMLElement,
  children: ReactNode, // ideally Menu<MenuProps>
  controlElement: HTMLElement,
  menuPlacement: MenuPlacement,
  menuPosition: MenuPosition,
};
interface MenuPortalState {
  placement: 'bottom' | 'top' | null;
}
interface PortalStyleArgs {
  offset: number;
  position: MenuPosition;
  rect: RectType;
}

export function menuPortalCSS(args: PortalStyleArgs): React.CSSProperties;

export class MenuPortal<OptionType extends OptionTypeBase> extends Component<MenuPortalProps<OptionType>, MenuPortalState> {
  static childContextTypes: {
    getPortalPlacement: (state: MenuState) => void,
  };
  getChildContext(): {
    getPortalPlacement: (state: MenuState) => void;
  };

  // callback for occassions where the menu must "flip"
  getPortalPlacement: (state: MenuState) => void;
}
