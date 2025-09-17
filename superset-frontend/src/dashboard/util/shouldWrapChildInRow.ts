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
import {
  DASHBOARD_GRID_TYPE,
  CHART_TYPE,
  COLUMN_TYPE,
  MARKDOWN_TYPE,
  TAB_TYPE,
} from './componentTypes';
import { ComponentType } from '../types';

interface WrapChildParams {
  parentType: ComponentType | undefined | null;
  childType: ComponentType | undefined | null;
}

type ParentTypes = typeof DASHBOARD_GRID_TYPE | typeof TAB_TYPE;
type ChildTypes = typeof CHART_TYPE | typeof COLUMN_TYPE | typeof MARKDOWN_TYPE;

const typeToWrapChildLookup: Record<
  ParentTypes,
  Record<ChildTypes, boolean>
> = {
  [DASHBOARD_GRID_TYPE]: {
    [CHART_TYPE]: true,
    [COLUMN_TYPE]: true,
    [MARKDOWN_TYPE]: true,
  },

  [TAB_TYPE]: {
    [CHART_TYPE]: true,
    [COLUMN_TYPE]: true,
    [MARKDOWN_TYPE]: true,
  },
};

export default function shouldWrapChildInRow({
  parentType,
  childType,
}: WrapChildParams): boolean {
  if (!parentType || !childType) return false;

  const wrapChildLookup = typeToWrapChildLookup[parentType as ParentTypes];
  if (!wrapChildLookup) return false;

  return Boolean(wrapChildLookup[childType as ChildTypes]);
}
