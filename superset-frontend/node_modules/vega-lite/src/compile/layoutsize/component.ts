import {Split} from '../split';

export type LayoutSize = number | 'container' | 'step' | 'merged';

export interface LayoutSizeIndex {
  width?: LayoutSize;
  height?: LayoutSize;
}

export type LayoutSizeComponent = Split<LayoutSizeIndex>;
