import GL from '@luma.gl/constants';
import {AGGREGATION_OPERATION} from '../aggregation-operation-utils';
export const DEFAULT_CHANGE_FLAGS = {
  dataChanged: true,
  viewportChanged: true,
  cellSizeChanged: true
};

export const DEFAULT_RUN_PARAMS = {
  changeFlags: DEFAULT_CHANGE_FLAGS,
  projectPoints: false,
  useGPU: true,
  fp64: false,
  viewport: null,
  gridTransformMatrix: null,
  createBufferObjects: true
};

export const MAX_32_BIT_FLOAT = 3.402823466e38;
export const MIN_BLEND_EQUATION = [GL.MIN, GL.FUNC_ADD];
export const MAX_BLEND_EQUATION = [GL.MAX, GL.FUNC_ADD];
export const MAX_MIN_BLEND_EQUATION = [GL.MAX, GL.MIN];
export const EQUATION_MAP = {
  [AGGREGATION_OPERATION.SUM]: GL.FUNC_ADD,
  [AGGREGATION_OPERATION.MEAN]: GL.FUNC_ADD,
  [AGGREGATION_OPERATION.MIN]: MIN_BLEND_EQUATION,
  [AGGREGATION_OPERATION.MAX]: MAX_BLEND_EQUATION
};

export const ELEMENTCOUNT = 4;
export const DEFAULT_WEIGHT_PARAMS = {
  size: 1,
  operation: AGGREGATION_OPERATION.SUM,
  needMin: false,
  needMax: false,
  combineMaxMin: false
};

export const IDENTITY_MATRIX = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
export const PIXEL_SIZE = 4; // RGBA32F
export const WEIGHT_SIZE = 3;
