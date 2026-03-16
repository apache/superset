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
import databaseData from '../../data/databases.json';
import type { DatabaseData } from './types';

const typedData = databaseData as DatabaseData;

const seenLogos = new Set<string>();
const databases = Object.entries(typedData.databases)
  .filter(([, db]) => db.documentation?.logo && db.documentation?.homepage_url)
  .sort(([a], [b]) => a.localeCompare(b))
  .filter(([, db]) => {
    const logo = db.documentation.logo!;
    if (seenLogos.has(logo)) return false;
    seenLogos.add(logo);
    return true;
  })
  .map(([name, db]) => ({
    name,
    logo: db.documentation.logo!,
    docPath: `/user-docs/databases/supported/${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`,
  }));

export default function DatabaseLogoWall(): React.JSX.Element {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '12px',
        margin: '20px auto',
        maxWidth: 900,
      }}
    >
      {databases.map(({ name, logo, docPath }) => (
        <a
          key={name}
          href={docPath}
          title={name}
          style={{ display: 'inline-flex', alignItems: 'center', height: 40 }}
        >
          <img
            src={`/img/databases/${logo}`}
            alt={name}
            className="database-logo"
            style={{ height: 36, maxWidth: 120 }}
          />
        </a>
      ))}
    </div>
  );
}
