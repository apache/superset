/*
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

import {
  QueryFormData,
  QueryContext,
  SetDataMaskHook,
  JsonObject,
} from '../..';
import ChartProps from '../models/ChartProps';
import { PlainObject } from './Base';

export type PlainProps = PlainObject;

type TransformFunction<Input = PlainProps, Output = PlainProps> = (
  x: Input,
) => Output;

export type PreTransformProps = TransformFunction<ChartProps, ChartProps>;
export type TransformProps<Props extends ChartProps = ChartProps> =
  TransformFunction<Props>;
export type PostTransformProps = TransformFunction;

export type BuildQueryFunction<T extends QueryFormData> = (
  formData: T,
  options?: {
    extras?: {
      cachedChanges?: any;
    };
    ownState?: JsonObject;
    hooks?: {
      setDataMask: SetDataMaskHook;
      setCachedChanges: (newChanges: any) => void;
    };
  },
) => QueryContext;

export default {};
