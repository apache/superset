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

import type { JSX } from 'react';
import Head from '@docusaurus/Head';
import { useLocation } from '@docusaurus/router';

interface TechArticleSchemaProps {
  title: string;
  description: string;
  datePublished?: string;
  dateModified?: string;
  keywords?: string[];
  proficiencyLevel?: 'Beginner' | 'Expert';
}

/**
 * Component that injects TechArticle JSON-LD structured data for documentation pages.
 * This helps search engines understand technical documentation content.
 *
 * @example
 * <TechArticleSchema
 *   title="Installing Superset with Docker"
 *   description="Learn how to install Apache Superset using Docker Compose"
 *   keywords={['docker', 'installation', 'superset']}
 *   proficiencyLevel="Beginner"
 * />
 */
export default function TechArticleSchema({
  title,
  description,
  datePublished,
  dateModified,
  keywords = [],
  proficiencyLevel = 'Beginner',
}: TechArticleSchemaProps): JSX.Element {
  const location = useLocation();
  const url = `https://superset.apache.org${location.pathname}`;

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: title,
    description,
    url,
    proficiencyLevel,
    author: {
      '@type': 'Organization',
      name: 'Apache Superset Contributors',
      url: 'https://github.com/apache/superset/graphs/contributors',
    },
    publisher: {
      '@type': 'Organization',
      name: 'Apache Software Foundation',
      url: 'https://www.apache.org/',
      logo: {
        '@type': 'ImageObject',
        url: 'https://www.apache.org/foundation/press/kit/asf_logo.png',
      },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': url,
    },
    ...(datePublished && { datePublished }),
    ...(dateModified && { dateModified }),
    ...(keywords.length > 0 && { keywords: keywords.join(', ') }),
  };

  return (
    <Head>
      <script type="application/ld+json">{JSON.stringify(schema)}</script>
    </Head>
  );
}
