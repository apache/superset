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
import { Button, Card, Input, Space, Tag, Tooltip } from 'antd';

// Import extension components from @apache-superset/core/ui
// This matches the established pattern used throughout the Superset codebase
// Resolved via webpack alias to superset-frontend/packages/superset-core/src/ui/components
import { Alert } from '@apache-superset/core/ui';

/**
 * ReactLiveScope provides the scope for live code blocks.
 * Any component added here will be available in ```tsx live blocks.
 *
 * To add more components:
 * 1. Import the component from @apache-superset/core above
 * 2. Add it to the scope object below
 */
const ReactLiveScope = {
  // React core
  React,
  ...React,

  // Extension components from @apache-superset/core
  Alert,

  // Common Ant Design components (for demos)
  Button,
  Card,
  Input,
  Space,
  Tag,
  Tooltip,
};

export default ReactLiveScope;
