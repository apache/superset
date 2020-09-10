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
import { css } from '@emotion/core';
import { Button } from 'antd';
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
    'Install on Windows 10',
    'https://gist.github.com/mark05e/d9cccae129dd11a21d7219eddd7d9923',
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

const resourcesContainer = css`
  background: #fff;
  .links {
    margin-top: 80px;
    .resourcesLinks {
      display: flex;
      flex-direction: row;
      flex-wrap: wrap;
      justify-content: center;
      text-align: center;
      .link {
        margin: 25px;
        width: 189px;
        position: relative;
        font-size: 16px;
        flex-direction: column;
        border: solid 1px #cbcbcb;
        border-radius: 5px;
        padding: 45px 36px;
        &:hover {
          border-color: #1fa8c9;
          cursor: pointer;
        }
        .youtube {
          width: 94px;
          height: 24px;
          margin-bottom: 40px;
        }
        .preset {
          margin-top: -13px;
          margin-bottom: -10px;
        }
        .ytBtn {
          position: absolute;
          top: 129px;
          left: 9px;
        }
        .title {
          margin-bottom: 59px;
        }
        .gBtn {
          margin-top: 10px;
        }
      }
      a {
        display: block;
        margin-bottom: 50px;
      }
      .gatsby-image-wrapper {
        display: block !important;
        margin-bottom: 40px;
      }
    }
  }
  .videos {
    text-align: center;
    iframe {
      margin: 15px;
    }
  }
  .span {
    display: block;
    text-align: center;
    font-size: 20px;
  }
  h2 {
    text-align: center;
    font-size: 35px;
  }
  .learnContent,
  .installation {
    margin-top: 25px;
    margin-bottom: 50px;
    a {
      display: block;
      text-align: center;
      font-size: 20px;
      margin: 15px;
    }
  }
  ul {
    display: table;
    margin: 0 auto;
    font-size: 20px;
    margin-top: 25px;
    margin-bottom: 25px;
  }
`;

const title = css`
  margin-top: 150px;
  text-align: center;
  font-size: 60px;
`;

const Resources = () => (
  <Layout>
    <SEO title="Resources" />
    <div css={resourcesContainer}>
      <h1 css={title}>Resources</h1>
      <span className="span">
        Here’s a collection of resources and blogs about Apache Superset
        {' '}
        <br />
        from around the Internet. If you find anything worth adding, you
        {' '}
        <br />
        can add to the list which can be found here
        <a href="https://github.com/apache-superset/awesome-apache-superset">
          Awesome Apache Superset
        </a>
      </span>
      <div className="links">
        <div>
          <h2> Getting Started Resources</h2>
          <div className="resourcesLinks">
            <div className="link">
              <div className="title">Docker Image</div>
              <a
                href="https://hub.docker.com/r/preset/superset/"
                target="_blank"
                rel="noreferrer"
              >
                <Button type="primary">Docker Image</Button>
              </a>
            </div>
            <div className="link">
              <div className="title">Preset Blog</div>
              <a
                href="https://preset.io/blog/"
                target="_blank"
                rel="noreferrer"
              >
                <Button type="primary"> Go To Blog!</Button>
              </a>
            </div>
            <div className="link">
              <div>Youtube Page</div>
              <a
                href="https://www.youtube.com/channel/UCMuwrvBsg_jjI2gLcm04R0g"
                target="_blank"
                rel="noreferrer"
              >
                <Button type="primary" className="ytBtn">
                  Go To YouTube Page!
                </Button>
              </a>
            </div>
            <div className="link">
              <div className="title">Install Drivers</div>
              <a
                href="https://preset.io/blog/2020-05-18-install-db-drivers/"
                target="_blank"
                rel="noreferrer"
              >
                <Button type="primary">Go To Blog!</Button>
              </a>
            </div>
            <div className="link">
              <div>Connect Superset To Google Sheets</div>
              <a
                href="https://preset.io/blog/2020-06-01-connect-superset-google-sheets/"
                target="_blank"
                rel="noreferrer"
              >
                <Button type="primary" className="gBtn">
                  Go To Blog!
                </Button>
              </a>
            </div>
          </div>
        </div>
        <div className="learnContent">
          <h2>Learning Content</h2>
          {links.map(([link, href]) => (
            <a href={href} target="_blank" rel="noreferrer">
              {link}
            </a>
          ))}
        </div>
        <div className="installation">
          <h2>Additional Installation Resources</h2>
          {installationLinks.map(([link, href]) => (
            <a href={href} target="_blank" rel="noreferrer">
              {link}
            </a>
          ))}
        </div>
        <div className="videos">
          <h2> Videos Content </h2>
          <iframe
            width="560"
            height="315"
            src="https://www.youtube.com/embed/24XDOkGJrEY"
            frameBorder="0"
            allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
          <iframe
            width="560"
            height="315"
            src="https://www.youtube.com/embed/AqousXQ7YHw"
            frameBorder="0"
            allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
          <iframe
            width="560"
            height="315"
            src="https://www.youtube.com/embed/JGeIHrQYhIs"
            frameBorder="0"
            allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
          <iframe
            width="560"
            height="315"
            src="https://www.youtube.com/embed/z350Gbi463I"
            frameBorder="0"
            allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
        <div>
          <ul>
            {additionalResources.map(([span, href]) => (
              <li>
                <a href={href} target="_blank" rel="noreferrer">
                  {span}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  </Layout>
);

export default Resources;
