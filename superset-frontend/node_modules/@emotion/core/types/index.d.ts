// Definitions by: Junyoung Clare Jang <https://github.com/Ailrun>
// TypeScript Version: 2.8

import { EmotionCache } from '@emotion/cache'
import css, { Interpolation, SerializedStyles } from '@emotion/css'
import { Keyframes } from '@emotion/serialize'
import {
  ClassAttributes,
  ComponentClass,
  Context,
  Provider,
  SFC,
  ReactElement,
  ReactNode,
  Ref,
  createElement
} from 'react'

export {
  ArrayInterpolation,
  ComponentSelector,
  CSSObject,
  FunctionInterpolation,
  ObjectInterpolation
} from '@emotion/css'

export { EmotionCache, Interpolation, SerializedStyles, css }

export const ThemeContext: Context<object>
export const CacheProvider: Provider<EmotionCache>
export function withEmotionCache<Props, RefType = any>(
  func: (props: Props, context: EmotionCache, ref: Ref<RefType>) => ReactNode
): SFC<Props & ClassAttributes<RefType>>

export const jsx: typeof createElement

export type InterpolationWithTheme<Theme> =
  | Interpolation
  | ((theme: Theme) => Interpolation)

export interface GlobalProps<Theme> {
  styles: InterpolationWithTheme<Theme>
}
/**
 * @desc
 * JSX generic are supported only after TS@2.9
 */
export function Global<Theme = any>(props: GlobalProps<Theme>): ReactElement

export function keyframes(
  template: TemplateStringsArray,
  ...args: Array<Interpolation>
): Keyframes
export function keyframes(...args: Array<Interpolation>): Keyframes

export interface ArrayClassNamesArg extends Array<ClassNamesArg> {}
export type ClassNamesArg =
  | undefined
  | null
  | string
  | boolean
  | { [className: string]: boolean | null | undefined }
  | ArrayClassNamesArg

export interface ClassNamesContent<Theme> {
  css(template: TemplateStringsArray, ...args: Array<Interpolation>): string
  css(...args: Array<Interpolation>): string
  cx(...args: Array<ClassNamesArg>): string
  theme: Theme
}
export interface ClassNamesProps<Theme> {
  children(content: ClassNamesContent<Theme>): ReactNode
}
/**
 * @desc
 * JSX generic are supported only after TS@2.9
 */
export function ClassNames<Theme = any>(
  props: ClassNamesProps<Theme>
): ReactElement

declare module 'react' {
  interface DOMAttributes<T> {
    css?: InterpolationWithTheme<any>
  }
}

declare global {
  namespace JSX {
    /**
     * Do we need to modify `LibraryManagedAttributes` too,
     * to make `className` props optional when `css` props is specified?
     */

    interface IntrinsicAttributes {
      css?: InterpolationWithTheme<any>
    }
  }
}
