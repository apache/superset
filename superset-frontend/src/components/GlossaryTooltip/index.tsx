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
import { Tooltip } from 'antd';
import type { GlossaryTooltipProps } from './types';
import { getGlossaryUrl } from './constants';

export const GlossaryTooltip: React.FC<GlossaryTooltipProps> = ({
  term,
  title,
  children, 
  ...props
}) => {
  const content = (
    <div>
      <div style={{ marginBottom: '8px' }}>{title}</div>
      {term && (
        <a
          href={getGlossaryUrl(term)}
          target="_blank"
        >
          Learn more →
        </a>
      )}
    </div>
  );

  return (
    <Tooltip title={content} {...props}>
      {children}
    </Tooltip>
  );
};

export { GLOSSARY_TERMS, type GlossaryTerm } from './constants';
export type { GlossaryTooltipProps } from './types';
