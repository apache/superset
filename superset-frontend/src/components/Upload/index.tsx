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
// Vanilla Ant Design components from v4 that require migration
// eslint-disable-next-line no-restricted-imports
import { Upload } from 'antd'; // TODO: Remove antd
// Vanilla Ant Design components from v4 that require migration
// eslint-disable-next-line no-restricted-imports
import { UploadChangeParam, UploadFile } from 'antd/lib/upload/interface'; // TODO: Remove antd NB: in this case use lib to avoid to encounter empty export

export default Upload;
export { UploadChangeParam, UploadFile };
