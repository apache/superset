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
import React, { useEffect, useState } from 'react';
// @ts-ignore
import OutsideClickHandler from 'react-outside-click-handler';

const NameComponent = styled.span`
  position: relative;
  left: 20px;
`;

const InputComponent = styled.input`
  width: 170px;
  position: relative;
  float: right;
`;

const ListComponent = styled.ul<{ showDropdown: boolean }>`
  position: relative;
  left: 100px;
  list-style-type: none;
  overflow-y: scroll;
  overflow-x: hidden;
  width: 230px;
  height: 250px;
  z-index: 99;
  opacity: 1;
  border: grey 1px solid;
  border-right: 4px;
  background-color: white;
  cursor: default;
  visibility: ${props => (props.showDropdown ? 'visibe' : 'hidden')};
  pointer-events: ${props => (props.showDropdown ? 'auto' : 'none')};
`;

const ListItemComponent = styled.li`
  :hover {
    background-color: #0a6ebd;
  }
  position: relative;
  width: 220px;
  right: 30px;
  height: 20px;
  line-height: 20px;
  z-index: 99;
  white-space: pre;
`;

export default function SearchDropDown(props: {
  values: string[];
  selectedValue: string;
  setSelectedValue: Function;
  name: any;
  defaultValue: string;
}) {
  const { values, selectedValue, setSelectedValue, name, defaultValue } = props;

  const [showDropdown, setShowDropdown] = useState(false);
  const [inputValue, setInputValue] = useState(selectedValue || defaultValue);

  let filteredValues = values;

  if (inputValue) {
    filteredValues = filteredValues.filter(value =>
      value
        .toString()
        .toLowerCase()
        .includes(inputValue.toString().toLowerCase()),
    );
  }
  filteredValues = filteredValues.slice(0, 199);

  useEffect(() => setInputValue(selectedValue), [selectedValue]);
  useEffect(() => setInputValue(defaultValue), [defaultValue]);

  const listItems = filteredValues.map(v => (
    <ListItemComponent
      onClick={() => {
        setShowDropdown(false);
        setSelectedValue(v);
        setInputValue(v);
      }}
    >
      {v}
    </ListItemComponent>
  ));

  return (
    <OutsideClickHandler
      disabled={!showDropdown}
      onOutsideClick={() => {
        setShowDropdown(false);
        setInputValue(selectedValue);
      }}
    >
      <NameComponent>{name}</NameComponent>
      <InputComponent
        value={inputValue}
        onFocus={() => {
          setShowDropdown(true);
          setInputValue('');
        }}
        onChange={e => setInputValue(e.target.value)}
      />
      <ListComponent showDropdown={showDropdown}>{listItems}</ListComponent>
    </OutsideClickHandler>
  );
}
