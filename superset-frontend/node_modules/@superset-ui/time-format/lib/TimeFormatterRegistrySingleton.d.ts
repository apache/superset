import TimeFormatterRegistry from './TimeFormatterRegistry';
import TimeFormatter from './TimeFormatter';
import { TimeGranularity } from './types';
import TimeRangeFormatter from './TimeRangeFormatter';
declare const getInstance: () => TimeFormatterRegistry;
export default getInstance;
export declare function getTimeRangeFormatter(formatId?: string): TimeRangeFormatter;
export declare function formatTimeRange(formatId: string | undefined, range: (Date | null | undefined)[]): string;
export declare function getTimeFormatter(formatId?: string, granularity?: TimeGranularity): TimeFormatter;
/**
 * Syntactic sugar for backward compatibility
 * TODO: Deprecate this in the next breaking change.
 * @param granularity
 */
export declare function getTimeFormatterForGranularity(granularity?: TimeGranularity): TimeFormatter;
export declare function formatTime(formatId: string | undefined, value: Date | null | undefined, granularity?: TimeGranularity): string;
//# sourceMappingURL=TimeFormatterRegistrySingleton.d.ts.map