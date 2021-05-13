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
import { useTheme } from '@superset-ui/core';
import Icons from 'src/components/Icons';
import {
  CaretContainer,
  CloseContainer,
  OptionControlContainer,
  Label,
} from 'src/explore/components/controls/OptionControls';
import { OptionProps } from 'src/explore/components/controls/DndColumnSelectControl/types';

export default function Option(props: OptionProps) {
  const theme = useTheme();
  return (
    <OptionControlContainer
      data-test="option-label"
      withCaret={props.withCaret}
    >
      <CloseContainer
        role="button"
        data-test="remove-control-button"
        onClick={() => props.clickClose(props.index)}
      >
        <Icons.XSmall color={theme.colors.grayscale.light1} />
      </CloseContainer>
      <Label data-test="control-label">{props.children}</Label>
      {props.withCaret && (
        <CaretContainer>
          <Icons.CaretRight color={theme.colors.grayscale.light1} />
        </CaretContainer>
      )}
    </OptionControlContainer>
  );
}
