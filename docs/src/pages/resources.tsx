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
import {
  Card, Row, Col, List, Modal, Button,
} from 'antd';
import SEO from '../components/seo';
import Layout from '../components/layout';

const learningLinks = [
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
    'Official Apache releases',
    'https://dist.apache.org/repos/dist/release/superset/',
  ],
  [
    'Locally with Docker',
    'https://superset.apache.org/installation.html#start-with-docker',
  ],
  [
    'Superset on the Python Package Index (PyPI)',
    'https://dist.apache.org/repos/dist/release/superset/',
  ],
  [
    'Install on CentOS',
    'https://aichamp.wordpress.com/2019/11/20/installing-apache-superset-into-centos-7-with-python-3-7/',
  ],
  [
    'Build Apache Superset from source',
    'https://hackernoon.com/a-better-guide-to-build-apache-superset-from-source-6f2ki32n0',
  ],
  [
    'Installing Apache Superset on IBM Kubernetes Cluster',
    'https://aklin.github.io/guides/kubernetes/2020/10/05/ibm-superset-guide/',
  ],
];

const youtubeVideos = [
  [
    '24XDOkGJrEY',
    'The history and anatomy of Apache Superset',
  ],
  [
    'AqousXQ7YHw',
    'Apache Superset for visualization and for data science',
  ],
  [
    'JGeIHrQYhIs',
    'Apache Superset- Interactive Multi Tab Multiple Dashboards Samples',
  ],
  [
    'z350Gbi463I',
    'Apache Superset - Interactive Sales Dashboard (Demo 1)',
  ],
];

const resourcesContainer = css`
  .link-section {
    margin-bottom: 24px;
    a {
      display: block;
    }
  }
  .links {
    .videos {
      margin-top: 50px;
      text-align: left;
      iframe {
        margin: 15px;
      }
    }
  }
`;

interface featureProps {
  title: string,
  links: string[][],
}
const LinkSection = ({ title, links }: featureProps) => (
  <div className="link-section">
    <h3>{title}</h3>
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
  </div>
);

const Resources = () => {
  const [showModal, setModal] = useState(false);
  const [videoId, setVideoId] = useState(null);
  const [cardTitle, setCardTitle] = useState(null);
  const handleClose = () => {
    setModal(false);
    setVideoId(null);
    setCardTitle(null);
  };
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
              list of resources, check out the
              {' '}
              <a href="https://github.com/apache-superset/awesome-apache-superset">
                Awesome Apache Superset
              </a>
              {' '}
              repository
            </span>
          </section>
          <section className="links">
            <Row gutter={24}>
              <Col md={12} sm={24} xs={24}>
                <LinkSection title="Learning Content" links={learningLinks} />
              </Col>
              <Col md={12} sm={24} xs={24}>
                <LinkSection title="Installation" links={installationLinks} />
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
                src={`https://www.youtube.com/embed/${(youtubeVideos[videoId] && youtubeVideos[videoId][0])}`}
                frameBorder="0"
                allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </Modal>
            <h2>Videos</h2>
            <Card>
              {youtubeVideos.map(([id, title], idx) => (
                <Card.Grid>
                  <div
                    role="button"
                    onClick={() => {
                      setModal(true);
                      setVideoId(idx);
                      setCardTitle(title);
                    }}
                  >
                    <h4>{title}</h4>
                    <img
                      width="100%"
                      alt="youtube vid"
                      src={`http://img.youtube.com/vi/${id}/maxresdefault.jpg`}
                    />
                  </div>
                </Card.Grid>
              ))}
            </Card>
          </section>
        </div>
      </div>
    </Layout>
  );
};

export default Resources;
