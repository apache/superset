export {default as parse} from './src/parse';
export {default as config} from './src/config';

export {default as signal} from './src/parsers/signal';
export {default as signalUpdates} from './src/parsers/signal-updates';
export {default as stream} from './src/parsers/stream';

export {
  MarkRole,
  FrameRole,
  ScopeRole,
  AxisRole,
  AxisDomainRole,
  AxisGridRole,
  AxisLabelRole,
  AxisTickRole,
  AxisTitleRole,
  LegendRole,
  LegendEntryRole,
  LegendLabelRole,
  LegendSymbolRole,
  LegendTitleRole
} from './src/parsers/marks/roles';

export {default as Scope} from './src/Scope';
export {default as DataScope} from './src/DataScope';
