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
import DocNavbarItem from '@theme-original/NavbarItem/DocNavbarItem';
import DocSidebarNavbarItem from '@theme-original/NavbarItem/DocSidebarNavbarItem';
import DocsVersionDropdownNavbarItem from '@theme-original/NavbarItem/DocsVersionDropdownNavbarItem';
import DocsVersionNavbarItem from '@theme-original/NavbarItem/DocsVersionNavbarItem';
import DropdownNavbarItem from '@theme-original/NavbarItem/DropdownNavbarItem';
import DefaultNavbarItem from '@theme-original/NavbarItem/DefaultNavbarItem';
import HtmlNavbarItem from '@theme-original/NavbarItem/HtmlNavbarItem';
import LocaleDropdownNavbarItem from '@theme-original/NavbarItem/LocaleDropdownNavbarItem';
import SearchNavbarItem from '@theme-original/NavbarItem/SearchNavbarItem';
import GetStartedSplitNavbarItem from './GetStartedSplitNavbarItem';

export default {
  default: DefaultNavbarItem,
  localeDropdown: LocaleDropdownNavbarItem,
  search: SearchNavbarItem,
  dropdown: DropdownNavbarItem,
  html: HtmlNavbarItem,
  doc: DocNavbarItem,
  docSidebar: DocSidebarNavbarItem,
  docsVersion: DocsVersionNavbarItem,
  docsVersionDropdown: DocsVersionDropdownNavbarItem,
  'custom-getStartedSplit': GetStartedSplitNavbarItem,
};
