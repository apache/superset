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
import styled from '@superset-ui/style';
import { css } from '@emotion/core';
// @ts-ignore
import Select, { Async } from 'react-select';

const styles = css`
  display: block;
  &.is-focused:not(.is-open) > .Select-control {
    border: none;
    box-shadow: none;
  }

  &.is-open > .Select-control .Select-arrow {
    top: 50%;
  }

  .Select-control {
    display: inline-flex;
    border: none;
    width: 128px;
    top: -5px;
    &:focus,
    &:hover {
      border: none;
      box-shadow: none;
    }
    .Select-multi-value-wrapper {
      display: flex;
    }
    .Select-value {
      position: relative;
      padding-right: 2px;
      max-width: 104px;
    }
    .Select-input {
      padding-left: 0;
      padding-right: 8px;
    }
    .Select-arrow-zone {
      width: auto;
      padding: 0;
      .Select-arrow {
        position: absolute;
        top: 50%;
        transform: translateY(-50%);
      }
    }
  }
  .Select-menu-outer {
    margin-top: 0;
    border-bottom-left-radius: 0;
    border-bottom-left-radius: 0;
  }
`;

export default styled(Select)`
  ${styles}
`;

export const AsyncStyledSelect = styled(Async)`
  ${styles}
`;
