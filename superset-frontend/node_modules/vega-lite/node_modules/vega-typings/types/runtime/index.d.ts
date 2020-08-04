import { DataType, EncodeEntryName, Format, SignalValue, Spec } from '../spec';
import { Renderers } from './renderer';
import { Transform, Changeset } from './dataflow';

// TODO
export type Runtime = any;

export const version: string;

// Locale API
export function formatLocale(definition: object): void;
export function timeFormatLocale(definition: object): void;

export function parse(spec: Spec, opt?: any): Runtime;

export interface Loader {
  load: (uri: string, options?: any) => Promise<string>;
  sanitize: (uri: string, options: any) => Promise<{ href: string }>;
  http: (uri: string, options: any) => Promise<string>;
  file: (filename: string) => Promise<string>;
}

export class View {
  constructor(runtime: Runtime, config?: any);
  initialize(dom?: Element | string): this;
  finalize(): void;
  logLevel(level: number): this;
  renderer(renderer: Renderers): this;
  loader(loader: Loader): this;

  hover(hoverSet?: EncodeEntryName, leaveSet?: EncodeEntryName): this;
  run(encode?: string): this;
  runAfter(callback: (view: this) => void, enqueue?: boolean, priority?: number): this;
  runAsync(): Promise<View>;
  insert(name: string, tuples: any): this;
  remove(name: string, tuples: any): this;
  change(name: string, changeset: Changeset): this;
  changeset(): any;
  data(name: string): any[];
  data(name: string, tuples: any): this;

  width(): number;
  width(w: number): this;
  height(): number;
  height(h: number): this;

  origin(): [number, number];

  padding(p: number | { left?: number; right?: number; top?: number; bottom?: number }): this;

  resize(): this;

  toImageURL(type: string, scaleFactor?: number): Promise<string>;
  toSVG(scaleFactor?: number): Promise<string>;
  toCanvas(
    scaleFactor?: number,
    options?: { type?: string; context?: any },
  ): Promise<HTMLCanvasElement>;

  signal(name: string, value: SignalValue): this;
  signal(name: string): SignalValue;
  container(): HTMLElement | null;
  addEventListener(type: string, handler: EventListenerHandler): this;
  removeEventListener(type: string, handler: EventListenerHandler): this;
  addSignalListener(name: string, handler: SignalListenerHandler): this;
  removeSignalListener(name: string, handler: SignalListenerHandler): this;
  addDataListener(name: string, handler: DataListenerHandler): this;
  removeDataListener(name: string, handler: DataListenerHandler): this;
  addResizeListener(handler: ResizeHandler): this;
  removeResizeListener(handler: ResizeHandler): this;
  tooltip(handler: TooltipHandler): this;

  getState(options?: {
    signals?: (name?: string, operator?: any) => boolean;
    data?: (name?: string, object?: any) => boolean;
    recurse?: boolean;
  }): { signals?: any; data?: any };
  setState(state: { signals?: any; data?: any }): this;
}

export type ScenegraphEvent = MouseEvent | TouchEvent | KeyboardEvent;

export const Warn: number;
export interface LoaderOptions {
  baseURL?: string;
  mode?: 'file' | 'http';
  defaultProtocol?: 'http' | 'https' | string;
  target?: string;
  http?: RequestInit;
}
export function loader(opt?: LoaderOptions): Loader;
export function read(
  data: string,
  schema: Format,
  dateParse?: (dateString: string) => Date,
): object[];

export type TypeInference = DataType | 'integer';
export function inferType(values: readonly any[], field?: string): TypeInference;
export function inferTypes(
  values: readonly any[],
  fields: readonly string[],
): { [field: string]: TypeInference };

export type EventListenerHandler = (event: ScenegraphEvent, item?: Item) => void;
export type SignalListenerHandler = (name: string, value: SignalValue) => void;
export type DataListenerHandler = (name: string, value: any) => void;
export type ResizeHandler = (width: number, height: number) => void;
export type TooltipHandler = (handler: any, event: MouseEvent, item: Item, value: any) => void;

export interface Item<T = any> {
  /**
   * The underlying data element to which this item corresponds.
   */
  datum: T;
  /**
   * The mark to which this item belongs.
   */
  mark: RuntimeMark;
}

export type RuntimeMark =
  | DefineMark<'group'>
  | DefineMark<'rect', { x: number; y: number; width: number; height: number; fill: number }>
  | DefineMark<'symbol', {}, 'legend-symbol'>
  | DefineMark<'path'>
  | DefineMark<'arc'>
  | DefineMark<'area'>
  | DefineMark<'line'>
  | DefineMark<'image'>
  | DefineMark<'text', {}, 'axis-label' | 'legend-label'>;

export interface DefineMark<T extends string, I = {}, R extends string = never> {
  marktype: T;
  role: 'mark' | R;
  items: Item<I>[];
  group: any;
}

// Extensibility: https://vega.github.io/vega/docs/api/extensibility/

export function projection(type: string, projection: any): View;

export function scale(type: string, scale?: any): any;

export function scheme(name: string, scheme?: any): any;
export function schemeDiscretized(name: string, scheme?: any, interpolator?: any): any;

export function expressionFunction(name: string, fn?: any, visitor?: any): any;

export const transforms: { [name: string]: Transform };

export * from 'vega-util';
export * from './renderer';
export * from './scene';
export * from './dataflow';
