// DODO was here
import {
  QueryFormData,
  supersetTheme,
  TimeseriesDataRecord,
  Metric,
  SimpleAdhocFilter,
  TimeRangeEndType, // DODO added 44211759
} from '@superset-ui/core';

export interface PopKPIStylesProps {
  height: number;
  width: number;
  headerFontSize: keyof typeof supersetTheme.typography.sizes;
  subheaderFontSize: keyof typeof supersetTheme.typography.sizes;
  boldText: boolean;
  comparisonColorEnabled: boolean;
}

interface PopKPICustomizeProps {
  headerText: string;
}

export interface PopKPIComparisonValueStyleProps {
  subheaderFontSize?: keyof typeof supersetTheme.typography.sizes;
}

export interface PopKPIComparisonSymbolStyleProps {
  backgroundColor: string;
  textColor: string;
}

export type PopKPIQueryFormData = QueryFormData &
  PopKPIStylesProps &
  PopKPICustomizeProps;

type PopKPIPropsDodoExtended = {
  dashboardTimeRangeEndType: TimeRangeEndType; // DODO added 44211759
};
export type PopKPIProps = PopKPIStylesProps &
  PopKPICustomizeProps & {
    data: TimeseriesDataRecord[];
    metrics: Metric[];
    metricName: string;
    bigNumber: string;
    prevNumber: string;
    valueDifference: string;
    percentDifferenceFormattedString: string;
    compType: string;
    percentDifferenceNumber: number;
    comparisonColorScheme?: string;
    currentTimeRangeFilter?: SimpleAdhocFilter;
    startDateOffset?: string;
    shift: string;
    dashboardTimeRange?: string;
  } & PopKPIPropsDodoExtended;

export enum ColorSchemeEnum {
  Green = 'Green',
  Red = 'Red',
}
