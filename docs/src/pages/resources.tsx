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
import React, { useState } from 'react';
import { css } from '@emotion/core';
import { Card, Row, Col, List, Modal, Button } from 'antd';
import SEO from '../components/seo';
import Layout from '../components/layout';

const links = [
  [
    "O'Reilly Live Training: Rapid Data Exploration and Analysis with Apache Superset",
    'https://learning.oreilly.com/live-training/courses/rapid-data-exploration-and-analysis-with-apache-superset/0636920457251/',
  ],
  [
    'Unlocking Advanced Data Analytics on The Data Lake Using Apache Superset and Dremio from Dremio',
    'https://www.dremio.com/tutorials/dremio-apache-superset/',
  ],
  [
    'Test-driving Apache Superset from SmartCat',
    'https://blog.smartcat.io/2018/test-driving-apache-superset/',
  ],
];

const installationLinks = [
  [
    'Locally with Docker',
    'https://superset.incubator.apache.org/installation.html#start-with-docker',
  ],
  [
    'Install on CentOS',
    'https://aichamp.wordpress.com/2019/11/20/installing-apache-superset-into-centos-7-with-python-3-7/',
  ],
  [
    'Build Apache Superset from source',
    'https://hackernoon.com/a-better-guide-to-build-apache-superset-from-source-6f2ki32n0',
  ],
];

const additionalResources = [
  [
    'YouTube Channel',
    'https://www.youtube.com/channel/UCMuwrvBsg_jjI2gLcm04R0g',
  ],
  [
    'May 15, 2020: Virtual Meetup Recording. Topics: 0.36 Overview, Committers Self-Intro, Roadmap',
    'https://www.youtube.com/watch?v=f6up5x_iRbI',
  ],
  [
    "O'Reilly Apache Superset Quick Start Guide",
    'https://www.oreilly.com/library/view/apache-superset-quick/9781788992244/',
  ],
  [
    'Getting Started with Apache Superset, an Enterprise-Ready Business Intelligence Platform',
    'https://reflectivedata.com/getting-started-apache-superset-enterprise-ready-business-intelligence-platform/',
  ],
  [
    'Unlocking Advanced Data Analytics on The Data Lake Using Apache Superset and Dremio',
    'https://www.dremio.com/tutorials/dremio-apache-superset/',
    {
      sub: 'Dremio',
      link: 'https://www.dremio.com',
    },
  ],
  [
    'Test-driving Apache Superset',
    'https://blog.smartcat.io/2018/test-driving-apache-superset/',
    {
      sub: 'SmartCat',
      link: 'https://smartcat.io',
    },
  ],
  [
    'Build Apache Superset from source',
    'https://hackernoon.com/a-better-guide-to-build-apache-superset-from-source-6f2ki32n0',
  ],
];

const youtubeRefs = [
  "https://www.youtube.com/embed/24XDOkGJrEY",
  "https://www.youtube.com/embed/AqousXQ7YHw",
  "https://www.youtube.com/embed/JGeIHrQYhIs",
  "https://www.youtube.com/embed/z350Gbi463I"
];

const youtubeIds = [
  [
    0,
    '24XDOkGJrEY',
    'The history and anatomy of Apache Superset'
  ],
  [
    1,
    'AqousXQ7YHw',
    'Apache Superset for visualization and for data science'
  ],
  [
    2,
    'JGeIHrQYhIs',
    'Apache Superset-Interactive Multi Tab Multiple Dashboards Samples'
  ],
  [
    3,
    'z350Gbi463I',
    'Apache Superset -Interactive Sales Dashboard (Demo 1)'
  ]
];

const resourcesContainer = css`
  .links {
    .videos {
      margin-top: 50px;
      text-align: left;
      iframe {
        margin: 15px;
      }
    }
    .learnContent,
    .installation {
      margin-top: 25px;
      margin-bottom: 50px;
      a {
        display: block;
        font-size: 17px;
        margin: 15px;
      }
    }
  }
`;

const Resources = () => {
  const [showModal, setModal] = useState(false);
  const [url, setUrl] = useState(null)
  const [cardTitle, setCardTitle] = useState(null);
  const handleClose = () => {
    setModal(false);
    setUrl(null);
    setCardTitle(null);
  }
  return (
    <Layout>
      <div className="contentPage">
        <SEO title="Resources" />
        <div css={resourcesContainer}>
          <section>
            <h1 className="title">Resources</h1>
            <span>
              Here’s a collection of resources and blogs about Apache Superset
              from around the Internet. For a more more extensive and dynamic
              list of resources, check out the{' '}
              <a href="https://github.com/apache-superset/awesome-apache-superset">
                Awesome Apache Superset
              </a>{' '}
              repository
            </span>
          </section>

          <section className="links">
            <Row gutter={{ xs: 8, sm: 16, md: 24, lg: 32 }}>
              <Col span={12}>
                <h2>Learning Content</h2>
                <List
                  size="small"
                  bordered
                  dataSource={links}
                  renderItem={([link, href]) => (
                    <List.Item>
                      <a href={href} target="_blank" rel="noreferrer">
                        {link}
                      </a>
                    </List.Item>
                  )}
                />
              </Col>
              <Col span={12}>
                <h2>Installation</h2>
                <List
                  size="small"
                  bordered
                  dataSource={installationLinks}
                  renderItem={([link, href]) => (
                    <List.Item>
                      <a href={href} target="_blank" rel="noreferrer">
                        {link}
                      </a>
                    </List.Item>
                  )}
                />
              </Col>
            </Row>
          </section>
          <section className="videos">
            <Modal
              title={cardTitle}
              visible={showModal}
              onOk={handleClose}
              onCancel={handleClose}
              width={610}
              footer={[
                <Button key="back" onClick={handleClose}>
                  Close
                </Button>,
              ]}
            >
              <iframe
                width="560"
                height="315"
                src={youtubeRefs[url]}
                frameBorder="0"
                allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </Modal>
            <h2>Videos</h2>
            <Card>
              {youtubeIds.map(([idx, ids, cardTitle]) => (
                <Card.Grid
                  onClick={() => {
                    setModal(true);
                    setUrl(idx);
                    setCardTitle(cardTitle);
                  }}
                >
                  <h4>{cardTitle}</h4>
                  <img
                    width="100%"
                    src={`http://img.youtube.com/vi/${ids}/maxresdefault.jpg`}
                  />
                </Card.Grid>
              ))}
            </Card>
          </section>
        </div>
      </div>
    </Layout>
  );
}

export default Resources;
