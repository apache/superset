/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import React, { useCallback } from 'react';
import { styled, t, useTheme } from '@superset-ui/core';
import Icons from 'src/components/Icons';
import {
  CaretContainer,
  CloseContainer,
  OptionControlContainer,
  Label,
} from 'src/explore/components/controls/OptionControls';
import { OptionProps } from 'src/explore/components/controls/DndColumnSelectControl/types';
import { InfoTooltipWithTrigger } from '@superset-ui/chart-controls';

const StyledInfoTooltipWithTrigger = styled(InfoTooltipWithTrigger)`
  margin: 0 ${({ theme }) => theme.gridUnit}px;
`;

export default function Option({
  children,
  index,
  clickClose,
  withCaret,
  isExtra,
  datasourceWarningMessage,
  canDelete = true,
}: OptionProps) {
  const theme = useTheme();
  const onClickClose = useCallback(
    e => {
      e.stopPropagation();
      clickClose(index);
    },
    [clickClose, index],
  );
  return (
    <OptionControlContainer data-test="option-label" withCaret={withCaret}>
      {canDelete && (
        <CloseContainer
          role="button"
          data-test="remove-control-button"
          onClick={onClickClose}
        >
          <Icons.XSmall iconColor={theme.colors.grayscale.light1} />
        </CloseContainer>
      )}
      <Label data-test="control-label">{children}</Label>
      {(!!datasourceWarningMessage || isExtra) && (
        <StyledInfoTooltipWithTrigger
          icon="exclamation-triangle"
          placement="top"
          bsStyle="warning"
          tooltip={
            datasourceWarningMessage ||
            t(`
                This filter was inherited from the dashboard's context.
                It won't be saved when saving the chart.
              `)
          }
        />
      )}
      {withCaret && (
        <CaretContainer>
          <Icons.CaretRight iconColor={theme.colors.grayscale.light1} />
        </CaretContainer>
      )}
    </OptionControlContainer>
  );
}
