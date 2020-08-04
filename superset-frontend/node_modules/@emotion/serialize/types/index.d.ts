// Definitions by: Junyoung Clare Jang <https://github.com/Ailrun>
// TypeScript Version: 2.8

import { RegisteredCache, SerializedStyles } from '@emotion/utils'
import * as CSS from 'csstype'

import { Equal } from './helper'

export { RegisteredCache, SerializedStyles }

export type CSSProperties = CSS.PropertiesFallback<number | string>
export type CSSPropertiesWithMultiValues = {
  [K in keyof CSSProperties]:
    | CSSProperties[K]
    | Array<Extract<CSSProperties[K], string>>
}
/**
 * @desc Following type exists for autocompletion of key.
 */
export type CSSPseudos<MP> = { [K in CSS.Pseudos]?: ObjectInterpolation<MP> }
export interface CSSOthersObject<MP> {
  [propertiesName: string]: Interpolation<MP>
}

export type CSSPseudosForCSSObject = { [K in CSS.Pseudos]?: CSSObject }

export interface ArrayCSSInterpolation extends Array<CSSInterpolation> {}

export type CSSInterpolation =
  | null
  | undefined
  | boolean
  | number
  | string
  | ComponentSelector
  | Keyframes
  | SerializedStyles
  | CSSObject
  | ArrayCSSInterpolation

export interface CSSOthersObjectForCSSObject {
  [propertiesName: string]: CSSInterpolation
}

export interface CSSObject
  extends CSSPropertiesWithMultiValues,
    CSSPseudosForCSSObject,
    CSSOthersObjectForCSSObject {}

export interface ComponentSelector {
  __emotion_styles: any
}

export type Keyframes = {
  name: string
  styles: string
  anim: number
  toString: () => string
} & string

export interface ArrayInterpolation<MP> extends Array<Interpolation<MP>> {}
export interface ObjectInterpolation<MP>
  extends CSSPropertiesWithMultiValues,
    CSSPseudos<MP>,
    CSSOthersObject<MP> {}
export type FunctionInterpolation<MP> = (mergedProps: MP) => Interpolation<MP>

export type Interpolation<MP = undefined> =
  | null
  | undefined
  | boolean
  | number
  | string
  | ComponentSelector
  | Keyframes
  | SerializedStyles
  | ArrayInterpolation<MP>
  | ObjectInterpolation<MP>
  | Equal<MP, undefined, never, FunctionInterpolation<MP>>

export function serializeStyles<MP>(
  args: Array<TemplateStringsArray | Interpolation<MP>>,
  registered: RegisteredCache,
  mergedProps?: MP
): SerializedStyles
