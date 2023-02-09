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
 import { t } from '@superset-ui/core';
 import { ControlPanelConfig, sections } from '@superset-ui/chart-controls';
 
 const config: ControlPanelConfig = {
   controlPanelSections: [
     sections.legacyRegularTime,
     {
       label: t('Query'),
       expanded: true,
       controlSetRows: [
         ['metric'],
         ['adhoc_filters'],
       ],
     },
     {
       label: t('Customize'),
       expanded: true,
       controlSetRows: [
         [
           {
             name: 'shape',
             config: {
               type: 'SelectControl',
               label: t('Shape'),
               default: 'rect',
               choices: [
                 // [value, label]
                 ['circle', t('Circle')],
                 ['diamond', t('Diamond')],
                 ['triangle', t('Triangle')],
                 ['pin', t('Pin')],
                 ['rect', t('Rectangle')],
               ],
               renderTrigger: true,
               description: t('What shape does the chart have'),
             },
           },
         ],
       ],
     },
   ],
 };
 
 export default config;