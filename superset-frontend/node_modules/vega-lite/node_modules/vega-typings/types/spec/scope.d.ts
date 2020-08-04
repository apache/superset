import { Axis, Data, Layout, Legend, Mark, Projection, Scale, Signal, Title } from '.';

export interface Scope {
  title?: string | Title;
  layout?: Layout;
  signals?: Signal[];
  projections?: Projection[];
  data?: Data[];
  scales?: Scale[];
  axes?: Axis[];
  legends?: Legend[];
  marks?: Mark[];
  usermeta?: object;
}
