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
import { QueryFormData, DataMask } from '@superset-ui/core';

export interface DeckglLayerVisibilityFormData extends QueryFormData {
  defaultToAllLayersVisible?: boolean;
}

export const DEFAULT_FORM_DATA: Partial<DeckglLayerVisibilityFormData> = {
  defaultToAllLayersVisible: true,
};

export interface LayerInfo {
  sliceId: number;
  name: string;
  type: string;
}

export interface PluginDeckglLayerVisibilityProps {
  formData: DeckglLayerVisibilityFormData;
  height: number;
  width: number;
  filterState: {
    value?: number[];
  };
  setDataMask: (dataMask: DataMask) => void;
  ownState?: {
    availableLayers?: LayerInfo[];
  };
}
