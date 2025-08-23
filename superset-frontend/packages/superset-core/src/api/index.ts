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

/**
 * @fileoverview Main entry point for the Superset Extension API.
 *
 * This module exports all public APIs for Superset extensions, providing
 * a unified interface for extension developers to interact with the Superset
 * platform. The API includes:
 *
 * - `authentication`: Handle user authentication and authorization
 * - `commands`: Execute Superset commands and operations
 * - `contributions`: Register UI contributions and customizations
 * - `core`: Access fundamental Superset types and utilities
 * - `environment`: Interact with the execution environment
 * - `extensions`: Manage extension lifecycle and metadata
 * - `sqlLab`: Integrate with SQL Lab functionality
 */

export * as authentication from './authentication';
export * as commands from './commands';
export * as contributions from './contributions';
export * as core from './core';
export * as environment from './environment';
export * as extensions from './extensions';
export * as sqlLab from './sqlLab';
