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
import React, { useState } from 'react';
import { useTheme } from '@superset-ui/core';
import ControlHeader from '../ControlHeader';
import InfoTooltipWithTrigger from '../InfoTooltipWithTrigger';
import { ControlFormItemComponents } from './controls';
export * from './controls';
/**
 * Accept `false` or `0`, but not empty string.
 */
function isEmptyValue(value) {
    return value == null || value === '';
}
export function ControlFormItem({ name, label, description, width, validators, required, onChange, value: initialValue, defaultValue, controlType, ...props }) {
    const { gridUnit } = useTheme();
    const [hovered, setHovered] = useState(false);
    const [value, setValue] = useState(initialValue === undefined ? defaultValue : initialValue);
    const [validationErrors, setValidationErrors] = useState();
    const handleChange = (e) => {
        const fieldValue = e && typeof e === 'object' && 'target' in e
            ? e.target.type === 'checkbox' || e.target.type === 'radio'
                ? e.target.checked
                : e.target.value
            : e;
        const errors = validators
            ?.map(validator => !required && isEmptyValue(fieldValue) ? false : validator(fieldValue))
            .filter(x => !!x) || [];
        setValidationErrors(errors);
        setValue(fieldValue);
        if (errors.length === 0 && onChange) {
            onChange(fieldValue);
        }
    };
    const Control = ControlFormItemComponents[controlType];
    return (<div css={{
            margin: 2 * gridUnit,
            width,
        }} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      {controlType === 'Checkbox' ? (<ControlFormItemComponents.Checkbox checked={value} onChange={handleChange}>
          {label}{' '}
          {hovered && description && (<InfoTooltipWithTrigger tooltip={description}/>)}
        </ControlFormItemComponents.Checkbox>) : (<>
          {label && (<ControlHeader name={name} label={label} description={description} validationErrors={validationErrors} hovered={hovered} required={required}/>)}
          {/* @ts-ignore */}
          <Control {...props} value={value} onChange={handleChange}/>
        </>)}
    </div>);
}
export default ControlFormItem;
//# sourceMappingURL=ControlFormItem.jsx.map