import * as Encode from './encode';
import { ExprRef } from './expr';
import { SortOrder, Scope, SignalRef, Transforms, OnMarkTrigger } from '.';

export type Facet =
  | {
      name: string;
      data: string;
      field: string;
    }
  | {
      name: string;
      data: string;
      groupby: string | string[];
      aggregate?: {
        cross?: boolean;
        fields: string[];
        ops: string[];
        as: string[];
      };
    };
export interface From {
  data?: string;
}
export type FromFacet =
  | From
  | (From & {
      facet: Facet;
    });
export type Clip =
  | boolean
  | {
      path: string | SignalRef;
    }
  | {
      sphere: string | SignalRef;
    };
export type Compare =
  | {
      field: string | ExprRef | SignalRef;
      order?: SortOrder;
    }
  | {
      field: (string | ExprRef | SignalRef)[];
      order?: SortOrder[];
    };
export interface BaseMark {
  role?: string;
  name?: string;
  description?: string;
  key?: string;
  clip?: Clip;
  sort?: Compare;
  interactive?: boolean | SignalRef;
  from?: From;
  transform?: Transforms[];
  zindex?: number;
  on?: OnMarkTrigger[];
  style?: string | string[];
}
export interface ArcMark extends BaseMark, Encode.Encodable<Encode.ArcEncodeEntry> {
  type: 'arc';
}
export interface AreaMark extends BaseMark, Encode.Encodable<Encode.AreaEncodeEntry> {
  type: 'area';
}
export interface ImageMark extends BaseMark, Encode.Encodable<Encode.ImageEncodeEntry> {
  type: 'image';
}
export interface GroupMark extends BaseMark, Scope, Encode.Encodable<Encode.GroupEncodeEntry> {
  type: 'group';
  from?: FromFacet;
}
export interface LineMark extends BaseMark, Encode.Encodable<Encode.LineEncodeEntry> {
  type: 'line';
}
export interface PathMark extends BaseMark, Encode.Encodable<Encode.PathEncodeEntry> {
  type: 'path';
}
export interface RectMark extends BaseMark, Encode.Encodable<Encode.RectEncodeEntry> {
  type: 'rect';
}
export interface RuleMark extends BaseMark, Encode.Encodable<Encode.RuleEncodeEntry> {
  type: 'rule';
}
export interface ShapeMark extends BaseMark, Encode.Encodable<Encode.ShapeEncodeEntry> {
  type: 'shape';
}
export interface SymbolMark extends BaseMark, Encode.Encodable<Encode.SymbolEncodeEntry> {
  type: 'symbol';
}
export interface TextMark extends BaseMark, Encode.Encodable<Encode.TextEncodeEntry> {
  type: 'text';
}
export interface TrailMark extends BaseMark, Encode.Encodable<Encode.TrailEncodeEntry> {
  type: 'trail';
}
export type Mark =
  | ArcMark
  | AreaMark
  | ImageMark
  | GroupMark
  | LineMark
  | PathMark
  | RectMark
  | RuleMark
  | ShapeMark
  | SymbolMark
  | TextMark
  | TrailMark;
