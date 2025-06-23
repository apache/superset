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
import { ImportResourceName } from 'src/views/CRUD/types';

export interface ImportModelsModalProps {
  resourceName: ImportResourceName;
  resourceLabel: string;
  passwordsNeededMessage: string;
  confirmOverwriteMessage: string;
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
  onModelImport: () => void;
  show: boolean;
  onHide: () => void;
  passwordFields?: string[];
  setPasswordFields?: (passwordFields: string[]) => void;
  sshTunnelPasswordFields?: string[];
  setSSHTunnelPasswordFields?: (sshTunnelPasswordFields: string[]) => void;
  sshTunnelPrivateKeyFields?: string[];
  setSSHTunnelPrivateKeyFields?: (sshTunnelPrivateKeyFields: string[]) => void;
  sshTunnelPrivateKeyPasswordFields?: string[];
  setSSHTunnelPrivateKeyPasswordFields?: (
    sshTunnelPrivateKeyPasswordFields: string[],
  ) => void;
}
