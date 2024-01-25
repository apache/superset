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
import { JsonEditor } from 'src/components/AsyncAceEditor';

const StyledJsonEditor = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const StyledJsonEditorLabel = styled.div`
  color: ${({ theme }) => theme.colors.dvt.text.label};
  font-size: 12px;
  font-weight: 500;
`;

const StyledJsonEditorInput = styled(JsonEditor)`
  flex: 1 1 auto;
  border-radius: 4px;

  &.ace-github .ace_gutter {
    background-color: ${({ theme }) => theme.colors.grayscale.light5};
  }
`;

export { StyledJsonEditor, StyledJsonEditorLabel, StyledJsonEditorInput };
