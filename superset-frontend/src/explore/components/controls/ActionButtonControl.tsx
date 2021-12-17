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
 import React, { ReactNode } from 'react';
 import { JsonValue, useTheme } from '@superset-ui/core';
 import ControlHeader from '../ControlHeader';
import { marginBottom } from 'src/views/CRUD/data/database/DatabaseModal/styles';
 
 // [value, label]
 export type ActionButtonOption = [
   JsonValue,
   Exclude<ReactNode, null | undefined | boolean>,
 ];
 
 export interface ActionButtonControlProps {
   label?: ReactNode;
   description?: string;
   options: ActionButtonOption[];
   hovered?: boolean;
   value?: string;
   onChange: (opt: ActionButtonOption[0]) => void;
 }
 
 export default function ActionButtonControl({
   value: initialValue,
   options,
   onChange,
   ...props
 }: ActionButtonControlProps) {
  //  const currentValue = initialValue || options[0][0];
   const theme = useTheme();
   return (
     <div
       css={{
        '.btn svg': {
          position: 'relative',
          top: '0.2em',
        },
        '.btn:focus': {
          outline: 'none',
          backgroundColor: theme.colors.grayscale.light5,
          borderColor: theme.colors.grayscale.light2
        },
        '.control-label + .btn-group': {
          marginTop: 1,
          textAlign: 'right'
        },
        '.btn-group .btn:active': {
          backgroundColor: '#e6e6e6',
        },
        '.btn-default': {
          margin: '0.8em 0em'
        }
       }}
       style={{textAlign: 'right'}}
     >
       <ControlHeader {...props} />
       <div className="btn-group btn-group-sm">
         {options.map(([val, label]) => (
           <button
             key={JSON.stringify(val)}
             type="button"
             className={`btn btn-default`}
             onClick={() => {
               onChange(val);
             }}
           >
             {label}
           </button>
         ))}
       </div>
     </div>
   );
 }
 