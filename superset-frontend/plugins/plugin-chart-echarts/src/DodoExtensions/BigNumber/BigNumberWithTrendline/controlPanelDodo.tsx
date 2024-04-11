import { GenericDataType, t } from '@superset-ui/core';
import {
  ControlPanelState,
  ControlState,
  Dataset,
} from '@superset-ui/chart-controls';

const BigNumberWithTrendlineControlPanelControlSetRowsDodo = [
  [
    {
      name: 'conditional_formatting',
      config: {
        type: 'ConditionalFormattingControlNoGradient',
        renderTrigger: true,
        label: t('Conditional Formatting'),
        description: t('Apply conditional color formatting to metric'),
        shouldMapStateToProps() {
          return true;
        },
        mapStateToProps(
          explore: ControlPanelState,
          _: ControlState,
          chart: Record<string, any>,
        ) {
          const verboseMap = explore?.datasource?.hasOwnProperty('verbose_map')
            ? (explore?.datasource as Dataset)?.verbose_map
            : explore?.datasource?.columns ?? {};
          const { colnames, coltypes } = chart?.queriesResponse?.[0] ?? {};
          const numericColumns =
            Array.isArray(colnames) && Array.isArray(coltypes)
              ? colnames
                  .filter(
                    (colname: string, index: number) =>
                      coltypes[index] === GenericDataType.NUMERIC,
                  )
                  .map(colname => ({
                    value: colname,
                    label: verboseMap[colname] ?? colname,
                  }))
              : [];
          return {
            columnOptions: numericColumns,
            verboseMap,
          };
        },
      },
    },
  ],
  [
    {
      name: 'comparison_period_conditional_formatting',
      config: {
        type: 'ConditionalFormattingControlDodo',
        renderTrigger: true,
        label: t('Comparison period conditional Formatting'),
        description: t('Apply comporation period conditional color formatting'),
        shouldMapStateToProps() {
          return false;
        },
      },
    },
  ],
];

export { BigNumberWithTrendlineControlPanelControlSetRowsDodo };
