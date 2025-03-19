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
import { ReactNode, useCallback, useState, useEffect } from 'react';
import { isEqual } from 'lodash';
import {
  ControlType,
  ControlComponentProps as BaseControlComponentProps,
} from '@superset-ui/chart-controls';
import {
  styled,
  JsonValue,
  QueryFormData,
  usePrevious,
} from '@superset-ui/core';
import ErrorBoundary from 'src/components/ErrorBoundary';
import { ExploreActions } from 'src/explore/actions/exploreActions';
import controlMap from './controls';

export type ControlProps = {
  // the actual action dispatcher (via bindActionCreators) has identical
  // signature to the original action factory.
  actions: Partial<ExploreActions> & Pick<ExploreActions, 'setControlValue'>;
  type: ControlType;
  label?: ReactNode;
  name: string;
  description?: ReactNode;
  tooltipOnClick?: () => ReactNode;
  places?: number;
  rightNode?: ReactNode;
  formData?: QueryFormData | null;
  value?: JsonValue;
  validationErrors?: any[];
  hidden?: boolean;
  renderTrigger?: boolean;
  default?: JsonValue;
  isVisible?: boolean;
  resetOnHide?: boolean;
};

/**
 *
 */
export type ControlComponentProps<ValueType extends JsonValue = JsonValue> =
  Omit<ControlProps, 'value'> & BaseControlComponentProps<ValueType>;

const StyledControl = styled.div`
  padding-bottom: ${({ theme }) => theme.gridUnit * 4}px;
`;

export default function Control(props: ControlProps) {
  const {
    actions: { setControlValue },
    name,
    type,
    hidden,
    isVisible,
    resetOnHide = true,
  } = props;

  const [hovered, setHovered] = useState(false);
  const wasVisible = usePrevious(isVisible);
  const onChange = useCallback(
    (value: any, errors: any[]) => setControlValue(name, value, errors),
    [name, setControlValue],
  );

  useEffect(() => {
    if (
      wasVisible === true &&
      isVisible === false &&
      props.default !== undefined &&
      !isEqual(props.value, props.default) &&
      resetOnHide
    ) {
      // reset control value if setting to invisible
      setControlValue?.(name, props.default);
    }
  }, [
    name,
    wasVisible,
    isVisible,
    setControlValue,
    props.value,
    props.default,
  ]);

  if (!type || isVisible === false) return null;

  const ControlComponent = typeof type === 'string' ? controlMap[type] : type;
  if (!ControlComponent) {
    // eslint-disable-next-line no-console
    console.warn(`Unknown controlType: ${type}`);
    return null;
  }

  return (
    <StyledControl
      className="Control"
      data-test={name}
      style={hidden ? { display: 'none' } : undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <ErrorBoundary>
        <ControlComponent onChange={onChange} hovered={hovered} {...props} />
      </ErrorBoundary>
    </StyledControl>
  );
}
