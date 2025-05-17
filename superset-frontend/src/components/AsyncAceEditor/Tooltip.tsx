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

import Handlebars from 'handlebars';
import { Tag } from 'src/components';

type Props = {
  title: string;
  icon?: string; // Pass in string if needed, or drop icon entirely
  body?: string;
  meta?: string;
  footer?: string;
};

export const Tooltip: React.FC<Props> = ({
  title,
  icon,
  body,
  meta,
  footer,
}) => (
  <div className="tooltip-detail">
    <div className="tooltip-detail-head">
      <div className="tooltip-detail-title">
        {icon}
        {title}
      </div>
      {meta && (
        <span className="tooltip-detail-meta">
          <Tag color="default">{meta}</Tag>
        </span>
      )}
    </div>
    {body && <div className="tooltip-detail-body">{body ?? title}</div>}
    {footer && <div className="tooltip-detail-footer">{footer}</div>}
  </div>
);

const tooltipTemplate = Handlebars.compile(`
  <div class="tooltip-detail">
    <div class="tooltip-detail-head">
      <div class="tooltip-detail-title">
        {{#if icon}}<span class="tooltip-icon">{{icon}}</span>{{/if}}{{title}}
      </div>
      {{#if meta}}
        <span class="tooltip-detail-meta"><span class="ant-tag">{{meta}}</span></span>
      {{/if}}
    </div>
    {{#if body}}
      <div class="tooltip-detail-body">{{body}}</div>
    {{/if}}
    {{#if footer}}
      <div class="tooltip-detail-footer">{{footer}}</div>
    {{/if}}
  </div>
`);

export const getTooltipHTML = (props: Props): string => tooltipTemplate(props);

export default Tooltip;
