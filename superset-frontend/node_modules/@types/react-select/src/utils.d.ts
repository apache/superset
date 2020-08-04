import * as React from 'react';
import {
  ClassNamesState,
  InputActionMeta,
  OptionsType,
  OptionTypeBase,
  ValueType,
} from './types';

// ==============================
// NO OP
// ==============================

export function noop(): void;
export function emptyString(): string;

// ==============================
// Class Name Prefixer
// ==============================

export function classNames(
  prefix?: string | null,
  cssKey?: string | null,
  state?: ClassNamesState,
  className?: string,
): string;

// ==============================
// Clean Value
// ==============================

export function cleanValue<OptionType extends OptionTypeBase>(value: ValueType<OptionType>): OptionsType<OptionType>;

// ==============================
// Handle Input Change
// ==============================

export function handleInputChange(
  inputValue: string,
  actionMeta: InputActionMeta,
  onInputChange?: (inputValue: string, actionMeta: InputActionMeta) => string | void
): string;

// ==============================
// Scroll Helpers
// ==============================

export function isDocumentElement(el: Element): boolean;

// Normalized Scroll Top
// ------------------------------

export function normalizedHeight(el: Element): number;

// Normalized scrollTo & scrollTop
// ------------------------------

export function getScrollTop(el: Element): number;

export function scrollTo(el: Element, top: number): void;

// Get Scroll Parent
// ------------------------------

export function getScrollParent(element: React.Ref<any>): Element;

// Animated Scroll To
// ------------------------------

export function animatedScrollTo(
  element: Element,
  to: number,
  duration: number,
  callback: (element: Element) => void
): void;

// Scroll Into View
// ------------------------------

export function scrollIntoView(
  menuEl: HTMLElement,
  focusedEl: HTMLElement
): void;

// ==============================
// Get bounding client object
// ==============================

// cannot get keys using array notation with DOMRect
export function getBoundingClientObj(element: HTMLElement): {
  bottom: number;
  height: number;
  left: number;
  right: number;
  top: number;
  width: number;
};
export interface RectType {
  left: number;
  right: number;
  bottom: number;
  height: number;
  width: number;
}

// ==============================
// String to Key (kebabify)
// ==============================

export function toKey(str: string): string;

// ==============================
// Touch Capability Detector
// ==============================

export function isTouchCapable(): boolean;

// ==============================
// Mobile Device Detector
// ==============================

export function isMobileDevice(): boolean;
