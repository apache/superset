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
import { CSSProperties, MouseEventHandler, ReactNode } from 'react';
import { SerializedStyles } from '@emotion/react';

export interface TagType {
  id?: number;
  className?: string;
  type?: string | number;
  editable?: boolean;
  onDelete?: (index: number) => void;
  onClick?: MouseEventHandler<HTMLSpanElement>;
  onMouseDown?: MouseEventHandler<HTMLSpanElement>;
  onClose?: () => void;
  color?: string;
  name?: string;
  index?: number;
  toolTipTitle?: string;
  children?: ReactNode;
  role?: string;
  style?: CSSProperties;
  icon?: ReactNode;
  css?: SerializedStyles;
  closable?: boolean;
}

export enum TagTypeEnum {
  Custom = 1,
  Type = 2,
  Owner = 3,
  FavoritedBy = 4,
}
