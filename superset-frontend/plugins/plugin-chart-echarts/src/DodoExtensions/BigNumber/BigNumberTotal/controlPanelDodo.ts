// DODO was here
import {
  ControlPanelState,
  ControlState,
  Dataset,
} from '@superset-ui/chart-controls';
import { GenericDataType, t } from '@superset-ui/core';

const BigNumberControlPanelControlSetRowsDodo = [
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
];

export { BigNumberControlPanelControlSetRowsDodo };
