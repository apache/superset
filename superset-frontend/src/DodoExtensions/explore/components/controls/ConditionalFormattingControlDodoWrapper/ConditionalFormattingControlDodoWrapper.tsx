// DODO was here
// DODO created 45525377
// take original file and mare wrapper for specific popups

import { useEffect, useState } from 'react';
import { styled, css } from '@superset-ui/core';
import { Comparator } from '@superset-ui/chart-controls';
import ControlHeader from 'src/explore/components/ControlHeader';
import { ConditionalFormattingConfig } from 'src/explore/components/controls/ConditionalFormattingControl';

import { ConditionalFormattingControlWrapperDodoProps } from './types';

const FormattersContainer = styled.div`
  ${({ theme }) => css`
    padding: ${theme.gridUnit}px;
    border: solid 1px ${theme.colors.grayscale.light2};
    border-radius: ${theme.gridUnit}px;
  `}
`;

const ConditionalFormattingControlDodoWrapper = ({
  value,
  onChange,
  columnOptions,
  verboseMap,
  removeIrrelevantConditions,
  renderExistLine,
  renderAddPopover,
  ...props
}: ConditionalFormattingControlWrapperDodoProps) => {
  const [conditionalFormattingConfigs, setConditionalFormattingConfigs] =
    useState<ConditionalFormattingConfig[]>(value ?? []);

  useEffect(() => {
    if (onChange) {
      onChange(conditionalFormattingConfigs);
    }
  }, [conditionalFormattingConfigs, onChange]);

  useEffect(() => {
    if (removeIrrelevantConditions) {
      // remove formatter when corresponding column is removed from controls
      const newFormattingConfigs = conditionalFormattingConfigs.filter(config =>
        columnOptions.some((option: any) => option?.value === config?.column),
      );
      if (
        newFormattingConfigs.length !== conditionalFormattingConfigs.length &&
        removeIrrelevantConditions
      ) {
        setConditionalFormattingConfigs(newFormattingConfigs);
      }
    }
  }, [conditionalFormattingConfigs, columnOptions, removeIrrelevantConditions]);

  const onDelete = (index: number) => {
    setConditionalFormattingConfigs(prevConfigs =>
      prevConfigs.filter((_, i) => i !== index),
    );
  };

  const onSave = (config: ConditionalFormattingConfig) => {
    setConditionalFormattingConfigs(prevConfigs => [...prevConfigs, config]);
  };

  const onEdit = (newConfig: ConditionalFormattingConfig, index: number) => {
    const newConfigs = [...conditionalFormattingConfigs];
    newConfigs.splice(index, 1, newConfig);
    setConditionalFormattingConfigs(newConfigs);
  };

  const createLabel = ({
    column,
    operator,
    targetValue,
    targetValueLeft,
    targetValueRight,
  }: ConditionalFormattingConfig) => {
    const columnName = (column && verboseMap?.[column]) ?? column;
    switch (operator) {
      case Comparator.None:
        return `${columnName}`;
      case Comparator.Between:
        return `${targetValueLeft} ${Comparator.LessThan} ${columnName} ${Comparator.LessThan} ${targetValueRight}`;
      case Comparator.BetweenOrEqual:
        return `${targetValueLeft} ${Comparator.LessOrEqual} ${columnName} ${Comparator.LessOrEqual} ${targetValueRight}`;
      case Comparator.BetweenOrLeftEqual:
        return `${targetValueLeft} ${Comparator.LessOrEqual} ${columnName} ${Comparator.LessThan} ${targetValueRight}`;
      case Comparator.BetweenOrRightEqual:
        return `${targetValueLeft} ${Comparator.LessThan} ${columnName} ${Comparator.LessOrEqual} ${targetValueRight}`;
      default:
        return `${columnName} ${operator} ${targetValue}`;
    }
  };

  return (
    <div>
      <ControlHeader {...props} />
      <FormattersContainer>
        {conditionalFormattingConfigs.map((config, index) =>
          renderExistLine({
            index,
            onEdit,
            onDelete,
            config,
            columnOptions,
            createLabel,
          }),
        )}

        {renderAddPopover({ columnOptions, onSave })}
      </FormattersContainer>
    </div>
  );
};

export default ConditionalFormattingControlDodoWrapper;
