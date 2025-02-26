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
// TODO: Check if this interface is needed
export interface ILocalizedString {
  /**
   * The localized value of the string.
   */
  value: string;

  /**
   * The original (non localized value of the string)
   */
  original: string;
}

export interface ICommand {
  command: string;
  title: string | ILocalizedString;
  // TODO: Given that we don't have the command pallete, we might not need the category
  category?: string | ILocalizedString;
}

export interface IMenu {
  command: string;
  alt?: string;
  // TODO: Discuss the when property in the context of the security manager
  when?: string;
  group?: string;
}

export interface IViewContainer {
  id: string;
  title: string;
}

export interface IView {
  id: string;
  name: string;
}

// TODO: Check if we will use the I prefix
// Inpired by https://github.com/microsoft/vscode/blob/3e141e276d4ac2ddb19916b66e7c8815af1b2a1f/src/vs/platform/extensions/common/extensions.ts#L187
export interface IExtensionContributions {
  commands?: ICommand[];
  menus?: { [context: string]: IMenu[] };

  // TODO: VSCode supports multiple view containers locations. We could restrict only to the activity bar.
  viewsContainers?: { [location: string]: IViewContainer[] };

  // TODO: Location might be a view container (left side bar), editors, panels, right side bar
  views?: { [location: string]: IView[] };
}
