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
import { styled } from '@superset-ui/core';

interface StyledTextAreaProps {
  typeDesign: string;
}

const StyleTextarea = styled.div`
  display: flex;
  flex-direction: column;
  gap: 9px;
`;

const StyleTextareaLabel = styled.div`
  font-size: 12px;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.dvt.text.help};
`;

const StyleTextareaText = styled.textarea<StyledTextAreaProps>`
  height: 169px;
  width: 100%;
  resize: none;
  border: none;
  outline: none;
  padding: 12px 8px;
  border-radius: ${({ typeDesign }) => (typeDesign ? '12px' : '4px')};
`;

export { StyleTextarea, StyleTextareaText, StyleTextareaLabel };
