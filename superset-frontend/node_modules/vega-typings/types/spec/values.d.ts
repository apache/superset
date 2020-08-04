import { Color } from './color';
import { StrokeCap } from './config';
import {
  Align,
  AlignValueRef,
  AnchorValueRef,
  ArrayValueRef,
  BooleanValueRef,
  ColorValueRef,
  FontStyle,
  FontStyleValueRef,
  FontWeight,
  FontWeightValueRef,
  NumericValueRef,
  Orient,
  OrientValueRef,
  StringValueRef,
  StrokeCapValueRef,
  SymbolShape,
  SymbolShapeValueRef,
  TextBaseline,
  TextBaselineValueRef,
} from './encode';
import { TitleAnchor } from './title';

export type NumberValue = number | NumericValueRef;

export type FontWeightValue = FontWeight | FontWeightValueRef;

export type FontStyleValue = FontStyle | FontStyleValueRef;

export type StringValue = string | StringValueRef;

export type ColorValue = null | Color | ColorValueRef;

export type AlignValue = Align | AlignValueRef;

export type StrokeCapValue = StrokeCap | StrokeCapValueRef;

export type TextBaselineValue = TextBaseline | TextBaselineValueRef;

export type SymbolShapeValue = SymbolShape | SymbolShapeValueRef;

export type BooleanValue = boolean | BooleanValueRef;

export type DashArrayValue = number[] | ArrayValueRef;

export type AnchorValue = TitleAnchor | AnchorValueRef;

export type OrientValue = Orient | OrientValueRef;
