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

const StyledDvtPagination = styled.div`
  display: flex;
  align-items: center;
`;

const StyledDvtPaginationText = styled.div`
  margin-left: 13px;
  margin-right: 13px;
`;

const StyledDvtPaginationButton = styled.div`
  position: relative;
  display: flex;
  width: 95px;
  height: 44px;
  flex-shrink: 0;
  border-radius: 12px;
  background-color: ${({ theme }) => theme.colors.dvt.primary.base};
`;

const StyledDvtPaginationIcon = styled.div`
  position: absolute;
  right: 0;
  display: flex;
  flex-direction: column;
  width: min-content;
  margin: 6px 9px 4.25px 0px;
`;

const StyledDvtPaginationPageNumber = styled.div`
  display: flex;
  align-items: center;
  margin: auto;
  color: ${({ theme }) => theme.colors.grayscale.light5};
  font-size: 24px;
  font-style: normal;
  font-weight: 500;
  line-height: normal;
`;

export {
  StyledDvtPagination,
  StyledDvtPaginationText,
  StyledDvtPaginationButton,
  StyledDvtPaginationIcon,
  StyledDvtPaginationPageNumber,
};
