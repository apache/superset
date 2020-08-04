// Definitions by: Junyoung Clare Jang <https://github.com/Ailrun>
// TypeScript Version: 2.4

export enum Context {
  POSTS = -2,
  PREPS = -1,
  UNKWN = 0,
  PROPS = 1,
  BLCKS = 2,
  ATRUL = 3
}

export type PrefixContext = Context.PROPS | Context.BLCKS | Context.ATRUL

export type Plugin = (
  this: Stylis,
  context: Context,
  content: any,
  selector: Array<string>,
  parent: Array<string>,
  line: number,
  column: number,
  length: number,
  at: number,
  depth: number
) => any

export interface ArrayPlugable extends Array<Plugable> {}
export type Plugable = undefined | null | boolean | Plugin | ArrayPlugable

export type StylisUse = (plugin?: Plugable) => StylisUse

export type StylisSet = (options: Options) => StylisSet

export type Prefix =
  | boolean
  | ((key: string, value: string, context: PrefixContext) => boolean)

export interface Options {
  prefix?: Prefix
}

export interface StylisConstructor {
  new (options?: Options): Stylis
}

interface Stylis extends StylisConstructor {
  (selector: string, properties: string): any
  use: StylisUse
  set: StylisSet
}

declare const Stylis: StylisConstructor

export default Stylis
