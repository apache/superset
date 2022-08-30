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

 import { css, SupersetTheme } from '@superset-ui/core';

 export const objectTagsStyles = (theme: SupersetTheme) => css`
  .ant-tag {
    color: ${theme.colors.grayscale.dark2};
  }
  
  .react-tags {
    position: relative;
    display: inline-block;
    padding: 1px 0 0 1px;
    margin: 0 ${theme.gridUnit * 2.5}px;
    border: 0px solid #f5f5f5;
    border-radius: 1px;
  
    /* shared font styles */
    font-size: ${theme.gridUnit * 3}px;
    line-height: 1.2;
  
    /* clicking anywhere will focus the input */
    cursor: text;
  }
  
  .react-tags__selected {
    display: inline;
  }
  
  .react-tags__selected-tag {
    display: inline-block;
    box-sizing: border-box;
    margin: 0;
    padding: ${theme.gridUnit * 1.5}px ${theme.gridUnit * 2}px;
    border: 0px solid #f5f5f5;
    border-radius: ${theme.borderRadius}px;
    background: #f1f1f1;
  
    /* match the font styles */
    font-size: inherit;
    line-height: inherit;
  }
  
  .react-tags__search {
    display: inline-block;
  
    /* new tag border layout */
    border: 1px dashed #d9d9d9;
  
    /* match tag layout */
    line-height: ${theme.gridUnit * 5}px;
    margin-bottom: 0;
    padding: 0 ${theme.gridUnit * 1.75}px;
  
    /* prevent autoresize overflowing the container */
    max-width: 100%;
  }
  
  .react-tags__search:focus-within {
    border: 1px solid ${theme.colors.grayscale.dark2};
  }
  
  @media screen and (min-width: ${theme.gridUnit * 7.5}em) {
    .react-tags__search {
      /* this will become the offsetParent for suggestions */
      position: relative;
    }
  }
  
  .react-tags__search input {
    max-width: 150%;
  
    /* remove styles and layout from this element */
    margin: 0;
    margin-left: 0;
    padding: 0;
    border: 0;
    outline: none;
  
    /* match the font styles */
    font-size: inherit;
    line-height: inherit;
  }
  
  .react-tags__search input::-ms-clear {
    display: none;
  }
  
  .react-tags__suggestions {
    position: absolute;
    top: 100%;
    left: 0;
    width: 100%;
    z-index: ${theme.zIndex.max};
  }
  
  @media screen and (min-width: ${theme.gridUnit * 7.5}em) {
    .react-tags__suggestions {
      width: ${theme.gridUnit * 60}px;
    }
  }
  
  .react-tags__suggestions ul {
    margin: 4px -1px;
    padding: 0;
    list-style: none;
    background: white;
    border: 1px solid #d1d1d1;
    border-radius: 2px;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
  }
  
  .react-tags__suggestions li {
    border-bottom: 1px solid #ddd;
    padding: ${ theme.gridUnit * 1.5}px ${theme.gridUnit * 2}px;
  }
  
  .react-tags__suggestions li mark {
    text-decoration: underline;
    background: none;
    font-weight: ${theme.typography.weights.bold};
  }
  
  .react-tags__suggestions li:hover {
    cursor: pointer;
    background: #eee;
  }
  
  .react-tags__suggestions li.is-active {
    background: #b7cfe0;
  }
  
  .react-tags__suggestions li.is-disabled {
    opacity: calc(${theme.opacity.mediumHeavy});
    cursor: auto;
  }
 `;
 