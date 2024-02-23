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
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { HandlerFunction, JsonValue, styled } from '@superset-ui/core';
import {
  RadioButtonOption,
  sharedControlComponents,
} from '@superset-ui/chart-controls';
import { AreaChartStackControlOptions } from '../constants';

const { RadioButtonControl } = sharedControlComponents;

const ExtraControlsWrapper = styled.div`
  text-align: center;
`;

export function useExtraControl<
  F extends {
    stack: any;
    area: boolean;
  },
>({
  formData,
  setControlValue,
}: {
  formData: F;
  setControlValue?: HandlerFunction;
}) {
  const { stack, area } = formData;
  const [extraValue, setExtraValue] = useState<JsonValue | undefined>(
    stack ?? undefined,
  );

  useEffect(() => {
    setExtraValue(stack);
  }, [stack]);

  const extraControlsOptions = useMemo(() => {
    if (area) {
      return AreaChartStackControlOptions;
    }
    return [];
  }, [area]);

  const extraControlsHandler = useCallback(
    (value: RadioButtonOption[0]) => {
      if (area) {
        if (setControlValue) {
          setControlValue('stack', value);
          setExtraValue(value);
        }
      }
    },
    [area, setControlValue],
  );

  return {
    extraControlsOptions,
    extraControlsHandler,
    extraValue,
  };
}

export function ExtraControls<
  F extends {
    stack: any;
    area: boolean;
    showExtraControls: boolean;
  },
>({
  formData,
  setControlValue,
}: {
  formData: F;
  setControlValue?: HandlerFunction;
}) {
  const { extraControlsOptions, extraControlsHandler, extraValue } =
    useExtraControl<F>({
      formData,
      setControlValue,
    });

  if (!formData.showExtraControls) {
    return null;
  }

  return (
    <ExtraControlsWrapper>
      <RadioButtonControl
        options={extraControlsOptions}
        onChange={extraControlsHandler}
        value={extraValue}
      />
    </ExtraControlsWrapper>
  );
}
