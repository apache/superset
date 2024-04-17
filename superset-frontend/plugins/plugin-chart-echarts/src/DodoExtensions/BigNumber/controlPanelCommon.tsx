import { GenericDataType, t } from '@superset-ui/core';
import {
  ControlPanelState,
  ControlState,
  Dataset,
} from '@superset-ui/chart-controls';
import React from 'react';
import { StyledFlag } from '../common';

const controlPanelCommonConditionalFormattingRow = [
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

const controlPanelCommonConditionalFormattingMessageRow = [
  {
    name: 'conditional_formatting_message',
    config: {
      type: 'ConditionalFormattingMessageControl',
      renderTrigger: true,
      label: t('Conditional formatting message'),
      description: t('Show conditional color formatting message'),
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

// DODO added #32232659
const controlPanelCommonChartDescription = {
  label: t('Chart description'),
  expanded: false,
  controlSetRows: [
    [
      {
        name: 'chart_description_ru',
        config: {
          type: 'TextAreaControlNoModal',
          label: (
            <>
              <StyledFlag
                style={{ display: 'inline', marginRight: '0.5rem' }}
                language="ru"
                pressToTheBottom={false}
              />
              <span>{t('Chart description')}</span>
            </>
          ),
          renderTrigger: true,
          description: t(
            'Tooltip text that shows up below this chart on dashboard',
          ),
        },
      },
    ],
    [
      {
        name: 'chart_description_en',
        config: {
          type: 'TextAreaControlNoModal',
          label: (
            <>
              <StyledFlag
                style={{ display: 'inline', marginRight: '0.5rem' }}
                language="gb"
                pressToTheBottom={false}
              />
              <span>{t('Chart description')}</span>
            </>
          ),
          renderTrigger: true,
          description: t(
            'Tooltip text that shows up below this chart on dashboard',
          ),
        },
      },
    ],
  ],
};

export {
  controlPanelCommonConditionalFormattingRow,
  controlPanelCommonConditionalFormattingMessageRow,
  controlPanelCommonChartDescription,
};
