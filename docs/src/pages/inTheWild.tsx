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

import Layout from '@theme/Layout';
import { Avatar, Card, Col, Collapse, Row, Typography } from 'antd';
import BlurredSection from '../components/BlurredSection';
import SectionHeader from '../components/SectionHeader';
import DataSet from '../../../RESOURCES/INTHEWILD.yaml';

const { Text, Link } = Typography;

interface Organization {
  name: string;
  url: string;
  logo?: string;
  contributors?: string[];
}

interface DataSetType {
  categories: Record<string, Organization[]>;
}

const typedDataSet = DataSet as DataSetType;

const ContributorAvatars = ({ contributors }: { contributors?: string[] }) => {
  if (!contributors?.length) return null;
  return (
    <Avatar.Group size="small" max={{ count: 3 }}>
      {contributors.map((handle) => {
        const username = handle.replace('@', '');
        return (
          <a
            key={username}
            href={`https://github.com/${username}`}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
          >
            <Avatar
              src={`https://github.com/${username}.png?size=40`}
              alt={username}
              style={{ cursor: 'pointer' }}
            >
              {username.charAt(0).toUpperCase()}
            </Avatar>
          </a>
        );
      })}
    </Avatar.Group>
  );
};

export default function InTheWild() {
  return (
    <Layout title="In the Wild" description="Organizations using Apache Superset">
      <main>
        <BlurredSection>
          <SectionHeader
            level="h2"
            title="In the Wild"
            subtitle="See who's using Superset and join our growing community"
          />
          <div style={{ textAlign: 'center', marginTop: 10 }}>
            <Link
              href="https://github.com/apache/superset/edit/master/RESOURCES/INTHEWILD.yaml"
              target="_blank"
            >
              Add your name/org!
            </Link>
          </div>
        </BlurredSection>

        <div style={{ maxWidth: 850, margin: '70px auto 60px', padding: '0 20px' }}>
          <Collapse
            bordered={false}
            defaultActiveKey={Object.keys(typedDataSet.categories)}
            style={{
              background: 'var(--ifm-background-color)',
              border: '1px solid var(--ifm-border-color)',
              borderRadius: 10,
            }}
            items={Object.entries(typedDataSet.categories).map(([category, items]) => {
              const logoItems = items.filter(({ logo }) => logo?.trim());
              const textItems = items.filter(({ logo }) => !logo?.trim());

              return {
                key: category,
                label: (
                  <Text strong style={{ fontSize: 16, lineHeight: '22px' }}>
                    {category} ({items.length})
                  </Text>
                ),
                children: (
                  <>
                    {logoItems.length > 0 && (
                      <Row gutter={[16, 16]} style={{ marginBottom: textItems.length > 0 ? 24 : 0 }}>
                        {logoItems.map(({ name, url, logo, contributors }) => (
                          <Col xs={24} sm={12} md={8} key={name}>
                            <a href={url} target="_blank" rel="noreferrer">
                              <Card
                                hoverable
                                style={{ height: 150, position: 'relative' }}
                                styles={{ body: { padding: 16, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' } }}
                              >
                                <img
                                  src={`/img/logos/${logo}`}
                                  alt={name}
                                  style={{ maxHeight: 80, maxWidth: '100%', objectFit: 'contain' }}
                                />
                                {contributors?.length && (
                                  <div style={{ position: 'absolute', bottom: 8, right: 8 }}>
                                    <ContributorAvatars contributors={contributors} />
                                  </div>
                                )}
                              </Card>
                            </a>
                          </Col>
                        ))}
                      </Row>
                    )}

                    {textItems.length > 0 && (
                      <Row gutter={[8, 8]}>
                        {textItems.map(({ name, url, contributors }) => (
                          <Col xs={24} sm={12} md={8} key={name}>
                            <a href={url} target="_blank" rel="noreferrer">
                              <Card
                                size="small"
                                hoverable
                                styles={{ body: { padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 } }}
                              >
                                <Text ellipsis style={{ flex: 1 }}>{name}</Text>
                                <ContributorAvatars contributors={contributors} />
                              </Card>
                            </a>
                          </Col>
                        ))}
                      </Row>
                    )}
                  </>
                ),
              };
            })}
          />
        </div>
      </main>
    </Layout>
  );
}
