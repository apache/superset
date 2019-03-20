interface Axis {
  title: string;
  tickCount: number;
  format: string;
}

export type XAxis = Axis & {
  orient: 'top' | 'bottom';
  labelAngle: number;
  labelOverlap: string;
};

export interface WithXAxis {
  axis?: XAxis;
}

export type YAxis = Axis & {
  orient: 'left' | 'right';
};

export interface WithYAxis {
  axis?: YAxis;
}

export interface WithAxis {
  axis?: XAxis | YAxis;
}
