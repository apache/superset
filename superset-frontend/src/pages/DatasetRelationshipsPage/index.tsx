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

import { useCallback } from 'react';
import { useHistory } from 'react-router-dom';
import { t } from '@apache-superset/core/translation';
import { Button, Icons } from '@superset-ui/core/components';
import RelationshipCanvas from 'src/features/datasets/relationships/components/RelationshipCanvas';

export default function DatasetRelationshipsPage() {
  const history = useHistory();

  const handleBack = useCallback(() => {
    history.push('/tablemodelview/list/');
  }, [history]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 100px)',
        padding: 16,
        background: 'linear-gradient(135deg, #fafafa 0%, #f0f4f8 100%)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Button buttonSize="small" buttonStyle="secondary" onClick={handleBack}>
            <Icons.LeftOutlined iconSize="s" /> {t('Back to Datasets')}
          </Button>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 'bold', color: '#222' }}>
            {t('Dataset Relationships')}
          </h2>
        </div>
      </div>
      <div style={{ flex: 1 }}>
        <RelationshipCanvas />
      </div>
    </div>
  );
}
