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

const StyledDotTitle = styled.div`
  display: flex;
  align-items: center;
`;

const StyledTitle = styled.div`
  font-size: 18px;
  font-weight: 700;
  line-height: 140%;
  letter-spacing: 0.2px;
`;

const StyledDotIcon = styled.div`
  display: flex;
  height: 48px;
  width: 48px;
  background-color: ${({ theme }) => theme.colors.dvt.success.light2};
  border-radius: 12px;
  margin-right: 16px;
`;

const StyledDot = styled.div`
  height: 16px;
  width: 16px;
  background-color: ${({ theme }) => theme.colors.dvt.success.base};
  border-radius: 50px;
  margin: auto;
`;

export { StyledDotTitle, StyledDotIcon, StyledDot, StyledTitle };
