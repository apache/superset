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
import React from 'react';

/**
 * A function which returns text (or marked-up text)
 * If what you want is a react component, don't use this. Use React.ComponentType instead.
 */
type ReturningDisplayable<P = void> = (props: P) => string | React.ReactElement;

/**
 * This type defines all available extensions of Superset's default UI.
 * Namespace the keys here to follow the form of 'some_domain.functionality.item'.
 * Take care to name your keys well, as the name describes what this extension point's role is in Superset.
 *
 * When defining a new option here, take care to keep any parameters to functions (or components) minimal.
 * Any removal or alteration to a parameter will be considered a breaking change.
 */
interface MenuObjectChildProps {
  label: string;
  name?: string;
  icon?: string;
  index?: number;
  url?: string;
  isFrontendRoute?: boolean;
  perm?: string | boolean;
  view?: string;
  disable?: boolean;
}

export interface SwitchProps {
  isEditMode: boolean;
  dbFetched: any;
  disableSSHTunnelingForEngine?: boolean;
  useSSHTunneling: boolean;
  setUseSSHTunneling: React.Dispatch<React.SetStateAction<boolean>>;
  setDB: React.Dispatch<any>;
  isSSHTunneling: boolean;
}

type ConfigDetailsProps = {
  embeddedId: string;
};

type RightMenuItemIconProps = {
  menuChild: MenuObjectChildProps;
};

type DatabaseDeleteRelatedExtensionProps = {
  database: object;
};

type DatasetDeleteRelatedExtensionProps = {
  dataset: object;
};

/**
 * Interface for extensions to database connections
 */
export interface DatabaseConnectionExtension {
  /**
   * Display title text for the extension show when creating a database connection
   */
  title: string;
  /**
   * url or dataURI (recommended) of a logo to use in place of a title.  title is fallback display if no logo is provided
   */
  logo?: React.ComponentType<any>;
  /**
   * Descriptive text displayed under the logo or title to provide user with more context about the configuration section
   */
  description: React.ComponentType<any>;
  /**
   * React component to render for display in the database connection configuration
   */
  component: React.ComponentType<any>;
  /**
   * Is the database extension enabled?
   */
  enabled: () => boolean;

  /**
   * Callbacks
   */
  // TODO: we need to move the db types to superset-ui/core in order to import them correctly
  onSave: (componentState: any, db: any) => any;
  onEdit?: (componentState: any) => void;
  onDelete?: (db: any) => void;
}

/**
 * Interface for extensions SQL Form.
 * These will be passed from the SQLEditor
 *
 * @param queryEditorId the queryEditor's id
 * @param setQueryEditorAndSaveSqlWithDebounce Debounced function that saves a query into the query editor
 * @param startQuery Callback that starts a query from the query editor
 */
export interface SQLFormExtensionProps {
  queryEditorId: string;
  setQueryEditorAndSaveSqlWithDebounce: (sql: string) => void;
  startQuery: (ctasArg?: any, ctas_method?: any) => void;
}

export interface SQLResultTableExtentionProps {
  queryId: string;
  orderedColumnKeys: string[];
  data: Record<string, unknown>[];
  height: number;
  filterText?: string;
  expandedColumns?: string[];
}

/**
 * Interface for extensions to Slice Header
 */
export interface SliceHeaderExtension {
  sliceId: number;
  dashboardId: number;
}

export type Extensions = Partial<{
  'alertsreports.header.icon': React.ComponentType;
  'embedded.documentation.configuration_details': React.ComponentType<ConfigDetailsProps>;
  'embedded.documentation.description': ReturningDisplayable;
  'embedded.documentation.url': string;
  'dashboard.nav.right': React.ComponentType;
  'navbar.right-menu.item.icon': React.ComponentType<RightMenuItemIconProps>;
  'navbar.right': React.ComponentType;
  'report-modal.dropdown.item.icon': React.ComponentType;
  'root.context.provider': React.ComponentType;
  'welcome.message': React.ComponentType;
  'welcome.banner': React.ComponentType;
  'welcome.main.replacement': React.ComponentType;
  'ssh_tunnel.form.switch': React.ComponentType<SwitchProps>;
  'databaseconnection.extraOption': DatabaseConnectionExtension;
  /* Custom components to show in the database and dataset delete modals */
  'database.delete.related': React.ComponentType<DatabaseDeleteRelatedExtensionProps>;
  'dataset.delete.related': React.ComponentType<DatasetDeleteRelatedExtensionProps>;
  'sqleditor.extension.form': React.ComponentType<SQLFormExtensionProps>;
  'sqleditor.extension.resultTable': React.ComponentType<SQLResultTableExtentionProps>;
  'dashboard.slice.header': React.ComponentType<SliceHeaderExtension>;
}>;
