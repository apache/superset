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

const StyledDvtTextareaSelectRun = styled.div`
  width: 1126px;
  height: 281px;
  border-radius: 12px;
`;

const StyledDvtTextarea = styled.textarea`
  width: 1066px;
  height: 187px;
  border: none;
  background: ${({ theme }) => theme.colors.grayscale.light5};
  color: ${({ theme }) => theme.colors.dvt.text.help};
  resize: none;
  margin: 30px 30px 0 30px;
  &:focus {
    outline: none;
  }
`;

const StyledDvtTextareaLimit = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  font-size: 16px;
  font-weight: 500;
  margin-right: 20px;
`;
const StyledDvtTextareaLimitInput = styled.input`
  max-width: 55px;
  background: ${({ theme }) => theme.colors.grayscale.light5};
  border: none;
  &:focus {
    outline: none;
  }
`;
const StyledDvtTextareaButton = styled.div`
  width: 110px;
  margin-left: 20px;
`;

export {
  StyledDvtTextarea,
  StyledDvtTextareaSelectRun,
  StyledDvtTextareaLimit,
  StyledDvtTextareaLimitInput,
  StyledDvtTextareaButton,
};
