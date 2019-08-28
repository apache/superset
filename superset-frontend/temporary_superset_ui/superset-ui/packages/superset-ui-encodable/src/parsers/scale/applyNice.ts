import {
  timeSecond,
  timeMinute,
  timeHour,
  timeDay,
  timeYear,
  timeMonth,
  timeWeek,
  utcSecond,
  utcMinute,
  utcHour,
  utcDay,
  utcWeek,
  utcMonth,
  utcYear,
  CountableTimeInterval,
} from 'd3-time';
import { ScaleTime } from 'd3-scale';
import { Value, ScaleType, NiceTime } from '../../types/VegaLite';
import { ScaleConfig, D3Scale } from '../../types/Scale';

const localTimeIntervals: {
  [key in NiceTime]: CountableTimeInterval;
} = {
  day: timeDay,
  hour: timeHour,
  minute: timeMinute,
  month: timeMonth,
  second: timeSecond,
  week: timeWeek,
  year: timeYear,
};

const utcIntervals: {
  [key in NiceTime]: CountableTimeInterval;
} = {
  day: utcDay,
  hour: utcHour,
  minute: utcMinute,
  month: utcMonth,
  second: utcSecond,
  week: utcWeek,
  year: utcYear,
};

// eslint-disable-next-line complexity
export default function applyNice<Output extends Value>(
  config: ScaleConfig<Output>,
  scale: D3Scale<Output>,
) {
  if ('nice' in config && typeof config.nice !== 'undefined' && 'nice' in scale) {
    const { nice } = config;
    if (typeof nice === 'boolean') {
      if (nice === true) {
        scale.nice();
      }
    } else if (typeof nice === 'number') {
      scale.nice(nice);
    } else {
      const timeScale = scale as ScaleTime<Output, Output>;
      const { type } = config;
      if (typeof nice === 'string') {
        timeScale.nice(type === ScaleType.UTC ? utcIntervals[nice] : localTimeIntervals[nice]);
      } else {
        const { interval, step } = nice;
        const parsedInterval = (type === ScaleType.UTC
          ? utcIntervals[interval]
          : localTimeIntervals[interval]
        ).every(step);

        if (parsedInterval !== null) {
          timeScale.nice(parsedInterval as CountableTimeInterval);
        }
      }
    }
  }
}
