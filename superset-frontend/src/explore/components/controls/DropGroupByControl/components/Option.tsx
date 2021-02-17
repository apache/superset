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
import React from 'react';
import { withTheme } from '@superset-ui/core';
import { ColumnOption } from '@superset-ui/chart-controls';
import Icon from 'src/components/Icon';
import {
  CaretContainer,
  CloseContainer,
  OptionControlContainer,
  Label,
} from 'src/explore/components/OptionControls';
import { OptionProps } from '../types';

function Option(props: OptionProps) {
  return (
    <OptionControlContainer data-test="option-label">
      <CloseContainer
        role="button"
        data-test="remove-control-button"
        onClick={() => props.clickClose(props.column.column_name)}
      >
        <Icon name="x-small" color={props.theme.colors.grayscale.light1} />
      </CloseContainer>
      <Label data-test="control-label">
        <ColumnOption column={props.column} showType />
      </Label>
      {props.withCaret && (
        <CaretContainer>
          <Icon
            name="caret-right"
            color={props.theme.colors.grayscale.light1}
          />
        </CaretContainer>
      )}
    </OptionControlContainer>
  );
}

export default withTheme(Option);
