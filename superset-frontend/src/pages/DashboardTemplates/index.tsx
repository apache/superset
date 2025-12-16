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

import React, { useState, useEffect } from 'react';
import { useHistory } from 'react-router-dom';
import { SupersetClient, t } from '@superset-ui/core';
import { PageHeaderWithActions } from 'src/components/PageHeaderWithActions';
import { DashboardTemplateGallery } from './DashboardTemplateGallery';
import { DashboardTemplate } from './types';

export default function DashboardTemplates() {
  const [templates, setTemplates] = useState<DashboardTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const history = useHistory();

  useEffect(() => {
    // Fetch templates from API
    SupersetClient.get({
      endpoint: '/api/v1/dashboard/templates',
    })
      .then(({ json }) => {
        setTemplates(json.result);
      })
      .catch(error => {
        console.error('Error fetching templates:', error);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const handleSelectTemplate = (template: DashboardTemplate | null) => {
    if (template === null || template.id === null) {
      // "Start from blank" selected - navigate to actual creation endpoint
      history.push('/dashboard/new');
    } else {
      // Navigate to template view (read-only dashboard)
      history.push(`/superset/dashboard/${template.uuid}/`);
    }
  };

  return (
    <>
      <PageHeaderWithActions
        title={t('Dashboard Templates')}
        subtitle={t(
          'Choose a template to get started or create a blank dashboard',
        )}
      />
      <DashboardTemplateGallery
        templates={templates}
        loading={loading}
        onSelectTemplate={handleSelectTemplate}
      />
    </>
  );
}
