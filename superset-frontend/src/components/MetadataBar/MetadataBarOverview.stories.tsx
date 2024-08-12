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

import Markdown from 'markdown-to-jsx';

export default {
  title: 'Design System/Components/MetadataBar/Overview',
};

export const MetadataBarOverview = () => (
  <>
    <Markdown>
      {`
# Metadata bar

The metadata bar component is used to display additional information about an entity.

## Usage

Some of the common applications in Superset are:

- Display the chart's metadata in Explore to help the user understand what dashboards this chart is added to and get
  to know the details of the chart
- Display the database's metadata in a drill to detail modal to help the user understand what data they are looking
  at while accessing the feature in the dashboard

## [Basic example]((./?path=/docs/design-system-components-metadatabar-examples--basic)
`}
    </Markdown>
    <Markdown>
      {`
## Variations

The metadata bar is by default a static component (besides the links in text).
The variations in this component are related to content and entity type as all of the details are predefined
in the code and should be specific for each metadata object.

Content types are predefined and consistent across the whole app. This means that
they will be displayed and behave in a consistent manner, keeping the same ordering,
information formatting, and interactions. For example, the Owner content type will always
have the same icon and when hovered it will present who created the entity, its current owners, and when the entity was created.

To extend the list of content types, a developer needs to request the inclusion of the new type in the design system.
This process is important to make sure the new type is reviewed by the design team, improving Superset consistency.

To check each content type in detail and its interactions, check the [MetadataBar](/story/design-system-components-metadatabar-examples--basic) page.
Below you can find the configurations for each content type:
    `}
    </Markdown>

    <Markdown>
      {`
\`\`\`
export enum MetadataType {
  Dashboards = 'dashboards',
  Description = 'description',
  LastModified = 'lastModified',
  Owner = 'owner',
  Rows = 'rows',
  Sql = 'sql',
  Table = 'table',
  Tags = 'tags',
};
\`\`\`
      `}
    </Markdown>

    <Markdown>
      {`
\`\`\`
export type Dashboards = {
  type: MetadataType.Dashboards;
  title: string;
  description?: string;
  onClick?: (type: string) => void;
};
\`\`\`
      `}
    </Markdown>

    <Markdown>
      {`
\`\`\`
export type Description = {
  type: MetadataType.Description;
  value: string;
  onClick?: (type: string) => void;
};
\`\`\`
      `}
    </Markdown>

    <Markdown>
      {`
\`\`\`
export type LastModified = {
  type: MetadataType.LastModified;
  value: Date;
  modifiedBy: string;
  onClick?: (type: string) => void;
};
\`\`\`
      `}
    </Markdown>

    <Markdown>
      {`
\`\`\`
export type Owner = {
  type: MetadataType.Owner;
  createdBy: string;
  owners: string[];
  createdOn: Date;
  onClick?: (type: string) => void;
};
\`\`\`
      `}
    </Markdown>

    <Markdown>
      {`
\`\`\`
export type Rows = {
  type: MetadataType.Rows;
  title: string;
  onClick?: (type: string) => void;
};
\`\`\`
      `}
    </Markdown>

    <Markdown>
      {`
\`\`\`
export type Sql = {
  type: MetadataType.Sql;
  title: string;
  onClick?: (type: string) => void;
};
\`\`\`
      `}
    </Markdown>

    <Markdown>
      {`
\`\`\`
export type Table = {
  type: MetadataType.Table;
  title: string;
  onClick?: (type: string) => void;
};
\`\`\`
      `}
    </Markdown>

    <Markdown>
      {`
\`\`\`
export type Tags = {
  type: MetadataType.Tags;
  values: string[];
  onClick?: (type: string) => void;
};
\`\`\`
      `}
    </Markdown>
  </>
);
