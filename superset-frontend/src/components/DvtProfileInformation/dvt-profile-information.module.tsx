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

const StyledProfileIndormation = styled.div`
  position: relative;
  width: 352px;
  height: 451px;
  border-radius: 12px;
  background-color: ${({ theme }) => theme.colors.grayscale.light5};
`;
const StyledProfileImage = styled.div`
  position: absolute;
  width: 155px;
  height: 155px;
  border-radius: 50px;
  top: -42px;
  right: 99px;
`;
const StyledHeading = styled.div`
  color: ${({ theme }) => theme.colors.dvt.text.bold};
  text-align: center;
  font-size: 27.5px;
  font-weight: 700;
  padding-top: 160px;
`;
const StyledInformation = styled.div`
  color: ${({ theme }) => theme.colors.dvt.text.help};
  text-align: center;
  font-size: 14px;
  font-weight: 500;
  letter-spacing: 0.2px;
  padding-top: 8px;
  padding-bottom: 33px;
`;

const StyledInformationDiv = styled.div``;

const StyledLabel = styled.div`
  color: ${({ theme }) => theme.colors.grayscale.dark2};
  text-align: center;
  font-size: 14px;
  font-weight: 500;
  padding-bottom: 12px;
`;

export {
  StyledProfileIndormation,
  StyledProfileImage,
  StyledHeading,
  StyledInformation,
  StyledInformationDiv,
  StyledLabel,
};
