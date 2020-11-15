export type SelectOptionType = {
  value: string;
  label: string;
};

export type DateTimeGrainType =
  | 'seconds'
  | 'minutes'
  | 'hours'
  | 'days'
  | 'weeks'
  | 'months'
  | 'years'
  | undefined;

export type ModeType = 'relative' | 'specific';

export type panelType = 'since' | 'until';

export type anchorModeType = 'now' | 'specific';

export type TimeRangeType = {
  sinceMode?: ModeType;
  sinceDatetime?: any;
  sinceGrain?: DateTimeGrainType;
  sinceGrainValue?: any;
  untilMode?: ModeType;
  untilDatetime?: any;
  untilGrain?: DateTimeGrainType;
  untilGrainValue?: any;
  anchorMode?: anchorModeType;
  anchorValue?: any;
};
