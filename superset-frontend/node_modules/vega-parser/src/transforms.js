import {entry} from './util';

const transform = name => (params, value, parent) =>
  entry(name, value, params || undefined, parent);

export var Aggregate = transform('aggregate');
export var AxisTicks = transform('axisticks');
export var Bound = transform('bound');
export var Collect = transform('collect');
export var Compare = transform('compare');
export var DataJoin = transform('datajoin');
export var Encode = transform('encode');
export var Expression = transform('expression');
export var Extent = transform('extent');
export var Facet = transform('facet');
export var Field = transform('field');
export var Key = transform('key');
export var LegendEntries = transform('legendentries');
export var Load = transform('load');
export var Mark = transform('mark');
export var MultiExtent = transform('multiextent');
export var MultiValues = transform('multivalues');
export var Overlap = transform('overlap');
export var Params = transform('params');
export var PreFacet = transform('prefacet');
export var Projection = transform('projection');
export var Proxy = transform('proxy');
export var Relay = transform('relay');
export var Render = transform('render');
export var Scale = transform('scale');
export var Sieve = transform('sieve');
export var SortItems = transform('sortitems');
export var ViewLayout = transform('viewlayout');
export var Values = transform('values');
