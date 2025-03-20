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

export interface Command {
  command: string;
  title: string;
}

export interface Menu {
  command: string;
  alt?: string;
  // TODO: Discuss the when property in the context of the security manager
  when?: string;
  group?: string;
}

export interface ViewContainer {
  id: string;
  title: string;
}

export interface View {
  id: string;
  name: string;
}

// Inpired by https://github.com/microsoft/vscode/blob/3e141e276d4ac2ddb19916b66e7c8815af1b2a1f/src/vs/platform/extensions/common/extensions.ts#L187
export interface Contributions {
  commands?: Command[];
  menus?: { [context: string]: Menu[] };

  // TODO: VSCode supports multiple view containers locations. We could restrict only to the activity bar.
  viewsContainers?: { [location: string]: ViewContainer[] };

  // TODO: Location might be a view container (left side bar), editors, panels, right side bar
  views?: { [location: string]: View[] };
}

/*
  We only allow to contribute viewContainers to the activity bar in SQL Lab.

  The built-in SQL Lab view containers are:
    "sqllab.activityBar",
    "sqllab.panels",
    "sqllab.rightSideBar",

    // TODO Need to think how to contribute an editor and the interfaces to exchange messages with the host

  "contributes": {
    "viewsContainers": {
      "sqllab.activityBar": [
        // custom view container
        {
          "id": "myCustomContainer",
          "title": "My Custom Container",
          "icon": "resources/custom-container.svg"
        },
      ],
    },
    "views": {
      "myCustomContainer": [
        {
          "id": "myView",
          "name": "My View"
        },
      ],
      "sqllab.panels": [
        {
          "id": "myView",
          "name": "My View"
        },
      ],
      "sqllab.rightSideBar": [
       {
          "id": "myView",
          "name": "My View"
        },
      ]
    }
  }
*/
