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
import React, { useState } from 'react';
import { Menu } from 'src/common/components';
import NavDropdown from 'src/components/NavDropdown';

export interface Languages {
  [key: string]: {
    flag: string;
    url: string;
    name: string;
  };
}

interface LanguagePickerProps {
  locale: string;
  languages: Languages;
}

export default function LanguagePicker({
  locale,
  languages,
}: LanguagePickerProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  return (
    <NavDropdown
      onMouseEnter={() => setDropdownOpen(true)}
      onMouseLeave={() => setDropdownOpen(false)}
      open={dropdownOpen}
      id="locale-dropdown"
      title={
        <span className="f16">
          <i className={`flag ${languages[locale].flag}`} />
        </span>
      }
    >
      <Menu
        onSelect={({ key }) => {
          window.location.href = languages[key].url;
        }}
      >
        {Object.keys(languages).map(langKey =>
          langKey === locale ? null : (
            <Menu.Item key={langKey}>
              {' '}
              <div className="f16">
                <i className={`flag ${languages[langKey].flag}`} /> -{' '}
                {languages[langKey].name}
              </div>
            </Menu.Item>
          ),
        )}
      </Menu>
    </NavDropdown>
  );
}
