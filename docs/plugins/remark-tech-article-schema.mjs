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

import { visit } from 'unist-util-visit';

/**
 * Remark plugin that automatically injects TechArticle schema import and component
 * into documentation MDX files based on frontmatter.
 *
 * This enables rich snippets for technical documentation in search results.
 *
 * Frontmatter options:
 * - title: (required) Article headline
 * - description: (required) Article description
 * - keywords: (optional) Array of keywords
 * - seo_proficiency: (optional) 'Beginner' or 'Expert', defaults to 'Beginner'
 * - seo_schema: (optional) Set to false to disable schema injection
 */
export default function remarkTechArticleSchema() {
  return (tree, file) => {
    const frontmatter = file.data.frontMatter || {};

    // Skip if explicitly disabled or missing required fields
    if (frontmatter.seo_schema === false) {
      return;
    }

    // Only add schema if we have title and description
    if (!frontmatter.title || !frontmatter.description) {
      return;
    }

    const title = frontmatter.title;
    const description = frontmatter.description;
    const keywords = frontmatter.keywords || [];
    const proficiencyLevel = frontmatter.seo_proficiency || 'Beginner';

    // Build the component props
    const keywordsStr = keywords.length > 0
      ? `keywords={${JSON.stringify(keywords)}}`
      : '';
    const proficiencyStr = proficiencyLevel !== 'Beginner'
      ? `proficiencyLevel="${proficiencyLevel}"`
      : '';

    // Create the import statement
    const importNode = {
      type: 'mdxjsEsm',
      value: `import TechArticleSchema from '@site/src/components/TechArticleSchema';`,
      data: {
        estree: {
          type: 'Program',
          sourceType: 'module',
          body: [
            {
              type: 'ImportDeclaration',
              specifiers: [
                {
                  type: 'ImportDefaultSpecifier',
                  local: { type: 'Identifier', name: 'TechArticleSchema' },
                },
              ],
              source: {
                type: 'Literal',
                value: '@site/src/components/TechArticleSchema',
              },
            },
          ],
        },
      },
    };

    // Create the component JSX
    const componentJsx = `<TechArticleSchema title=${JSON.stringify(title)} description=${JSON.stringify(description)} ${keywordsStr} ${proficiencyStr} />`;

    const componentNode = {
      type: 'mdxJsxFlowElement',
      name: 'TechArticleSchema',
      attributes: [
        {
          type: 'mdxJsxAttribute',
          name: 'title',
          value: title,
        },
        {
          type: 'mdxJsxAttribute',
          name: 'description',
          value: description,
        },
        ...(keywords.length > 0
          ? [
              {
                type: 'mdxJsxAttribute',
                name: 'keywords',
                value: {
                  type: 'mdxJsxAttributeValueExpression',
                  value: JSON.stringify(keywords),
                  data: {
                    estree: {
                      type: 'Program',
                      sourceType: 'module',
                      body: [
                        {
                          type: 'ExpressionStatement',
                          expression: {
                            type: 'ArrayExpression',
                            elements: keywords.map((k) => ({
                              type: 'Literal',
                              value: k,
                            })),
                          },
                        },
                      ],
                    },
                  },
                },
              },
            ]
          : []),
        ...(proficiencyLevel !== 'Beginner'
          ? [
              {
                type: 'mdxJsxAttribute',
                name: 'proficiencyLevel',
                value: proficiencyLevel,
              },
            ]
          : []),
      ],
      children: [],
    };

    // Insert import at the beginning
    tree.children.unshift(importNode);

    // Find the first heading and insert component after it
    let insertIndex = 1; // Default: after import
    for (let i = 1; i < tree.children.length; i++) {
      if (tree.children[i].type === 'heading') {
        insertIndex = i + 1;
        break;
      }
    }

    tree.children.splice(insertIndex, 0, componentNode);
  };
}
