/*
 * @flow
 */
import type {
  JSXAttribute,
  JSXOpeningElement,
 } from 'ast-types-flow';

export type ESLintJSXAttribute = {
  parent: JSXOpeningElement
} & JSXAttribute;
