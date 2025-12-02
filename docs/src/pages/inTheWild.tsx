// Updated version of the page with the requested text added

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
import { useEffect, useState } from 'react';
import BlurredSection from '../components/BlurredSection';
import { Collapse } from 'antd';
import Layout from '@theme/Layout';
import { results as DataSet } from '../../static/resources/inTheWild.js';
import styled from '@emotion/styled';
import SectionHeader from '../components/SectionHeader';
import { mq } from '../utils';

const StyledGrid = styled('div')`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 20px;
  max-width: 800px;
  margin: 30px auto;
  padding: 0 20px;
  ${mq[1]} {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  ${mq[0]} {
    grid-template-columns: repeat(1, minmax(0, 1fr));
  }
`;

const Card = styled('div')`
  border: 1px solid var(--ifm-border-color);
  border-radius: 10px;
  padding: 20px;
  text-align: center;
  background: linear-gradient(180deg, rgba(0,122,204,0.06) 0%, rgba(0,122,204,0.03) 100%);
  height: 150px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  transition: box-shadow 0.25s ease, transform 0.25s ease;
  strong {
    font-size: 20px;
    transition: color 0.25s ease;
  }
  a:hover strong {
    color: var(--ifm-color-primary);
  }
  a:hover {
    text-decoration: none;
  }
  a:hover ~ & {
    box-shadow: 0 4px 14px rgba(0,0,0,0.12);
    transform: translateY(-2px);
  }
`;

const LinkedCard = styled(Card)`
  cursor: pointer;
  a {
    display: flex;
    flex-direction: column;
    align-items: center;
    height: 100%;
    justify-content: center;
  }
  img {
    height: 80px;
    margin-bottom: 12px;
  }
`;

// Hover styles for collapse headers
const CollapseStyles = styled('div')`
  .ant-collapse-header:hover {
    background-color: rgba(0, 120, 200, 0.1);
    transition: background-color 0.2s ease;
  }
`;

export default function NewPage() {
  const [imagesLoaded, setImagesLoaded] = useState(false);

  useEffect(() => {
    const logos = Object.values(DataSet.categories)
      .flat()
      .map(item => (item.logo || '').trim())
      .filter(Boolean);

    if (logos.length === 0) {
      setImagesLoaded(true);
      return;
    }

    let loaded = 0;
    const imageObjects = logos.map(src => {
      const img = new Image();
      img.onload = () => {
        loaded += 1;
        if (loaded === logos.length) setImagesLoaded(true);
      };
      img.onerror = () => {
        loaded += 1;
        if (loaded === logos.length) setImagesLoaded(true);
      };
      img.src = `/img/logos/${src}`;
      return img;
    });

    return () => {
      imageObjects.forEach(img => {
        img.onload = null;
        img.onerror = null;
      });
    };
  }, []);

  if (!imagesLoaded) return null;

  return (
    <Layout title="In the Wild" description="Visually display our users">
      <main>
        <BlurredSection>
          <SectionHeader
            level="h2"
            title="Superset Users"
            subtitle="See who's using Superset and join our growing community"
          />
          <div style={{ textAlign: 'center', marginTop: '10px' }}>
            <a
              href="https://github.com/apache/superset/blob/master/RESOURCES/INTHEWILD.md"
              target="_blank"
              rel="noreferrer"
              style={{ fontSize: '16px', fontWeight: 400 }}
            >
              Add your name/org!
            </a>
          </div>
        </BlurredSection>

        <div style={{ height: '100px' }}></div>

        <div style={{ maxWidth: '850px', margin: '0 auto' }}>
          <CollapseStyles>
            <Collapse
              accordion
              bordered={false}
              style={{
                background: 'var(--ifm-background-color)',
                border: '1px solid var(--ifm-border-color)',
                borderRadius: '10px',
                padding: '10px'
              }}
            >
              {Object.entries(DataSet.categories).map(([category, items]) => (
                <Collapse.Panel
                  header={
                    <span
                      style={{
                        color: 'var(--ifm-font-base-color)',
                        fontSize: '22px',
                        fontWeight: 600
                      }}
                    >
                      {`${category} (${items.length})`}
                    </span>
                  }
                  key={category}
                  style={{ borderBottom: '1px solid var(--ifm-border-color)' }}
                >
                  <StyledGrid>
                    {items.map(({ name, url, logo }, index) => (
                      logo && logo.trim() !== '' ? (
                        <LinkedCard key={index}>
                          <a href={url} target="_blank" rel="noreferrer">
                            <img src={`/img/logos/${logo}`} alt={name} />
                          </a>
                        </LinkedCard>
                      ) : (
                        <Card key={index}>
                          <a href={url} target="_blank" rel="noreferrer">
                            <strong>{name}</strong>
                          </a>
                        </Card>
                      )
                    ))}
                  </StyledGrid>
                </Collapse.Panel>
              ))}
            </Collapse>
          </CollapseStyles>
        </div>

        <div style={{ height: '60px' }}></div>
      </main>
    </Layout>
  );
}