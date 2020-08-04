// Definitions by: Junyoung Clare Jang <https://github.com/Ailrun>
// TypeScript Version: 3.1

/**
 * @desc
 * In following types,
 * `InnerProps` is type parameter that represents props type of
 * internal component (target of styling)
 * `ExtraProps` is type parameter that represents extra props type of
 * styled component.
 * `StyleProps` is type parameter that represents props used in
 * a style of that component.
 */

import { ComponentSelector, Interpolation } from '@emotion/serialize'
import * as React from 'react'

import { Omit, Overwrapped, PropsOf } from './helper'

export {
  ArrayInterpolation,
  CSSObject,
  FunctionInterpolation,
  ObjectInterpolation
} from '@emotion/serialize'

export { ComponentSelector, Interpolation }

type JSXInEl = JSX.IntrinsicElements

export type WithTheme<P, T> = P extends { theme: infer Theme }
  ? P & { theme: Exclude<Theme, undefined> }
  : P & { theme: T }

export interface StyledOptions {
  label?: string
  shouldForwardProp?(propName: string): boolean
  target?: string
}

export interface StyledComponent<InnerProps, StyleProps, Theme extends object>
  extends React.SFC<InnerProps & Omit<StyleProps, 'theme'> & { theme?: Theme }>,
    ComponentSelector {
  /**
   * @desc this method is type-unsafe
   */
  withComponent<NewTag extends keyof JSXInEl>(
    tag: NewTag
  ): StyledComponent<JSXInEl[NewTag], StyleProps, Theme>
  withComponent<Tag extends React.ComponentType<any>>(
    tag: Tag
  ): StyledComponent<PropsOf<Tag>, StyleProps, Theme>
}

type ReactClassPropKeys = keyof React.ClassAttributes<any>

interface CreateStyledComponentBaseThemeless<InnerProps, ExtraProps> {
  <
    StyleProps extends Omit<
      Overwrapped<InnerProps, StyleProps>,
      ReactClassPropKeys
    > = Omit<InnerProps & ExtraProps, ReactClassPropKeys>,
    Theme extends object = object
  >(
    ...styles: Array<Interpolation<WithTheme<StyleProps, Theme>>>
  ): StyledComponent<InnerProps, StyleProps, Theme>
  <
    StyleProps extends Omit<
      Overwrapped<InnerProps, StyleProps>,
      ReactClassPropKeys
    > = Omit<InnerProps & ExtraProps, ReactClassPropKeys>,
    Theme extends object = object
  >(
    template: TemplateStringsArray,
    ...styles: Array<Interpolation<WithTheme<StyleProps, Theme>>>
  ): StyledComponent<InnerProps, StyleProps, Theme>
}

interface CreateStyledComponentBaseThemed<
  InnerProps,
  ExtraProps,
  StyledInstanceTheme extends object
> {
  <
    StyleProps extends Omit<
      Overwrapped<InnerProps, StyleProps>,
      ReactClassPropKeys
    > = Omit<InnerProps & ExtraProps, ReactClassPropKeys>
  >(
    ...styles: Array<Interpolation<WithTheme<StyleProps, StyledInstanceTheme>>>
  ): StyledComponent<InnerProps, StyleProps, StyledInstanceTheme>
  <
    StyleProps extends Omit<
      Overwrapped<InnerProps, StyleProps>,
      ReactClassPropKeys
    > = Omit<InnerProps & ExtraProps, ReactClassPropKeys>
  >(
    template: TemplateStringsArray,
    ...styles: Array<Interpolation<WithTheme<StyleProps, StyledInstanceTheme>>>
  ): StyledComponent<InnerProps, StyleProps, StyledInstanceTheme>
}

export type CreateStyledComponentBase<
  InnerProps,
  ExtraProps,
  StyledInstanceTheme extends object
> =
  // this "reversed" condition checks if StyledInstanceTheme was already parametrized when using CreateStyled
  object extends StyledInstanceTheme
    ? CreateStyledComponentBaseThemeless<InnerProps, ExtraProps>
    : CreateStyledComponentBaseThemed<
        InnerProps,
        ExtraProps,
        StyledInstanceTheme
      >

export type CreateStyledComponentIntrinsic<
  Tag extends keyof JSXInEl,
  ExtraProps,
  Theme extends object
> = CreateStyledComponentBase<JSXInEl[Tag], ExtraProps, Theme>
export type CreateStyledComponentExtrinsic<
  Tag extends React.ComponentType<any>,
  ExtraProps,
  Theme extends object
> = CreateStyledComponentBase<PropsOf<Tag>, ExtraProps, Theme>

/**
 * @desc
 * This function accepts `InnerProps`/`Tag` to infer the type of `tag`,
 * and accepts `ExtraProps` for user who use string style
 * to be able to declare extra props without using
 * `` styled('button')<ExtraProps>`...` ``, which does not supported in
 * styled-component VSCode extension.
 * If your tool support syntax highlighting for `` styled('button')<ExtraProps>`...` ``
 * it could be more efficient.
 */
export interface CreateStyled<Theme extends object = any> {
  <Tag extends React.ComponentType<any>, ExtraProps = {}>(
    tag: Tag,
    options?: StyledOptions
  ): CreateStyledComponentExtrinsic<Tag, ExtraProps, Theme>

  <Tag extends keyof JSXInEl, ExtraProps = {}>(
    tag: Tag,
    options?: StyledOptions
  ): CreateStyledComponentIntrinsic<Tag, ExtraProps, Theme>
}

declare const styled: CreateStyled
export default styled
