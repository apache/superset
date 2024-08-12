import { JsonObject } from '@superset-ui/core';
import { InputProps } from 'antd/lib/input';
import { ChangeEvent, EventHandler, FormEvent } from 'react';

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
type DatabaseUser = {
  first_name: string;
  last_name: string;
};

export type CatalogObject = {
  name: string;
  value: string;
};

export type SSHTunnelObject = {
  id?: number;
  server_address?: string;
  server_port?: number;
  username?: string;
  password?: string;
  private_key?: string;
  private_key_password?: string;
};

export type DatabaseObject = {
  // Connection + general
  backend?: string;
  changed_on?: string;
  changed_on_delta_humanized?: string;
  configuration_method: ConfigurationMethod;
  created_by?: null | DatabaseUser;
  database_name: string;
  driver: string;
  engine?: string;
  extra?: string;
  id: number;
  uuid?: null | string;
  name: string; // synonym to database_name
  paramProperties?: Record<string, any>;
  sqlalchemy_uri?: string;
  sqlalchemy_uri_placeholder?: string;
  parameters?: {
    access_token?: string;
    database_name?: string;
    host?: string;
    port?: number;
    database?: string;
    default_catalog?: string;
    default_schema?: string;
    http_path_field?: string;
    username?: string;
    password?: string;
    encryption?: boolean;
    credentials_info?: string;
    service_account_info?: string;
    query?: Record<string, string>;
    catalog?: Record<string, string | undefined>;
    properties?: Record<string, any>;
    warehouse?: string;
    role?: string;
    account?: string;
    ssh?: boolean;
  };

  // Performance
  cache_timeout?: string;
  allow_run_async?: boolean;

  // SQL Lab
  allows_cost_estimate?: boolean;
  allow_ctas?: boolean;
  allow_cvas?: boolean;
  allow_dml?: boolean;
  allows_virtual_table_explore?: boolean;
  expose_in_sqllab?: boolean;
  force_ctas_schema?: string;
  extra_json?: ExtraJson;

  // Security
  allow_file_upload?: boolean;
  impersonate_user?: boolean;
  masked_encrypted_extra?: string;
  parameters_schema?: Record<string, any>;
  server_cert?: string;

  // External management
  is_managed_externally: boolean;

  // Temporary storage
  catalog?: Array<CatalogObject>;
  query_input?: string;

  // DB Engine Spec information
  engine_information?: {
    supports_file_upload?: boolean;
    disable_ssh_tunneling?: boolean;
    supports_dynamic_catalog?: boolean;
  };

  // SSH Tunnel information
  ssh_tunnel?: SSHTunnelObject | null;
};

export type DatabaseForm = {
  default_driver: string;
  engine: string;
  name: string;
  parameters: {
    properties: {
      database: {
        description: string;
        type: string;
      };
      default_catalog: {
        description: string;
        type: string;
      };
      default_schema: {
        description: string;
        type: string;
      };
      http_path_field: {
        description: string;
        type: string;
      };
      host: {
        description: string;
        type: string;
      };
      password: {
        description: string;
        nullable: boolean;
        type: string;
      };
      port: {
        description: string;
        format: string;
        type: string;
      };
      query: {
        additionalProperties: {};
        description: string;
        type: string;
      };
      username: {
        description: string;
        nullable: boolean;
        type: string;
      };
      credentials_info: {
        description: string;
        nullable: boolean;
        type: string;
      };
      service_account_info: {
        description: string;
        nullable: boolean;
        type: string;
      };
    };
    required: string[];
    type: string;
  };
  ssh_tunnel: {
    properties: {
      ssh_address: {
        description: string;
        type: string;
      };
      ssh_port: {
        description: string;
        format: string;
        type: string;
      };
      username: {
        description: string;
        type: string;
      };
      password: {
        description: string;
        nullable: boolean;
        type: string;
      };
      private_key: {
        description: string;
        nullable: boolean;
        type: string;
      };
      private_key_password: {
        description: string;
        nullable: boolean;
        type: string;
      };
    };
    required: string[];
    type: string;
  };
  preferred: boolean;
  sqlalchemy_uri_placeholder: string;
  engine_information: {
    supports_file_upload: boolean;
    disable_ssh_tunneling: boolean;
    supports_dynamic_catalog: boolean;
  };
};

// the values should align with the database
// model enum in superset/superset/models/core.py
export enum ConfigurationMethod {
  SqlalchemyUri = 'sqlalchemy_form',
  DynamicForm = 'dynamic_form',
}

export enum Engines {
  GSheet = 'gsheets',
  Snowflake = 'snowflake',
}

export interface ExtraJson {
  allows_virtual_table_explore?: boolean; // in SQL Lab
  cancel_query_on_windows_unload?: boolean; // in Performance
  cost_estimate_enabled?: boolean; // in SQL Lab
  disable_data_preview?: boolean; // in SQL Lab
  disable_drill_to_detail?: boolean;
  allow_multi_catalog?: boolean;
  engine_params?: {
    catalog?: Record<string, string>;
    connect_args?: {
      http_path?: string;
    };
  };
  metadata_params?: {};
  metadata_cache_timeout?: {
    schema_cache_timeout?: number; // in Performance
    table_cache_timeout?: number; // in Performance
  }; // No field, holds schema and table timeout
  schemas_allowed_for_file_upload?: string[]; // in Security
  schema_options?: {
    expand_rows?: boolean;
  };
  version?: string;
}

export type CustomTextType = {
  value?: string | boolean | number;
  type?: string | null;
  name?: string;
  checked?: boolean;
};

type CustomHTMLInputElement = Omit<Partial<CustomTextType>, 'value' | 'type'> &
  CustomTextType;

type CustomHTMLTextAreaElement = Omit<
  Partial<CustomTextType>,
  'value' | 'type'
> &
  CustomTextType;

export type CustomParametersChangeType<T = CustomTextType> =
  | FormEvent<InputProps>
  | { target: T };

export type CustomEventHandlerType = EventHandler<
  ChangeEvent<CustomHTMLInputElement | CustomHTMLTextAreaElement>
>;

export interface FieldPropTypes {
  required: boolean;
  hasTooltip?: boolean;
  tooltipText?: (value: any) => string;
  placeholder?: string;
  onParametersChange: (event: CustomParametersChangeType) => void;
  onParametersUploadFileChange: (value: any) => string;
  changeMethods: {
    onParametersChange: (event: CustomParametersChangeType) => void;
  } & {
    onChange: (value: any) => string;
  } & {
    onQueryChange: (value: any) => string;
  } & { onParametersUploadFileChange: (value: any) => string } & {
    onAddTableCatalog: () => void;
    onRemoveTableCatalog: (idx: number) => void;
  } & {
    onExtraInputChange: (value: any) => void;
    onSSHTunnelParametersChange: CustomEventHandlerType;
  };
  validationErrors: JsonObject | null;
  getValidation: () => void;
  clearValidationErrors: () => void;
  db?: DatabaseObject;
  dbModel?: DatabaseForm;
  field: string;
  default_value?: any;
  description?: string;
  isEditMode?: boolean;
  sslForced?: boolean;
  defaultDBName?: string;
  editNewDb?: boolean;
}

type ChangeMethodsType = FieldPropTypes['changeMethods'];

// changeMethods compatibility with dynamic forms
type SwitchPropsChangeMethodsType = {
  onParametersChange: ChangeMethodsType['onParametersChange'];
};

export type SwitchProps = {
  dbModel: DatabaseForm;
  db: DatabaseObject;
  changeMethods: SwitchPropsChangeMethodsType;
  clearValidationErrors: () => void;
};
