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
import { styled } from '@apache-superset/core/theme';
import { createRef } from 'react';
import { HandlebarsViewer } from './components/Handlebars/HandlebarsViewer';
import { HandlebarsProps, HandlebarsStylesProps } from './types';

const Styles = styled.div<HandlebarsStylesProps>`
  padding: ${({ theme }) => theme.sizeUnit * 4}px;
  border-radius: ${({ theme }) => theme.borderRadius}px;
  height: ${({ height }) => height}px;
  width: ${({ width }) => width}px;
  overflow: auto;
`;

export default function Handlebars(props: HandlebarsProps) {
  const { data, height, width, formData } = props;
  const styleTemplateSource = formData.styleTemplate
    ? `<style>${formData.styleTemplate}</style>`
    : '';
  const handlebarTemplateSource = formData.handlebarsTemplate
    ? formData.handlebarsTemplate
    : '{{data}}';
  // Markdown only treats `<style>` as a raw-text block that may contain blank
  // lines when the tag starts a block of its own. Joined to the template by a
  // single newline, a template opening with an HTML tag absorbed the tag into
  // its own block instead, so the first blank line in the CSS closed that
  // block and every rule after it was parsed as Markdown and rendered as
  // visible chart content. A blank line ends the template's block first, so
  // the style block starts one of its own.
  //
  // The separator is added only when there is CSS to append: a blank line at
  // the end of the template is not always inert, and appending one when the
  // chart has no CSS at all would be a change to every existing template for
  // no reason. Keep the style block last so the template stays first in the
  // DOM, where positional selectors and cascade order expect it.
  const templateSource = styleTemplateSource
    ? `${handlebarTemplateSource}\n\n${styleTemplateSource} `
    : `${handlebarTemplateSource}\n `;

  const rootElem = createRef<HTMLDivElement>();

  return (
    <Styles ref={rootElem} height={height} width={width}>
      <HandlebarsViewer data={{ data }} templateSource={templateSource} />
    </Styles>
  );
}
