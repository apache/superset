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
import { Button, Card } from 'antd';
import { GithubOutlined } from '@ant-design/icons';
import SEO from '../components/seo';
import Layout from '../components/layout';
import { pmc } from '../resources/data';

const { Meta } = Card;

const links = [
  [
    'https://apache-superset.slack.com/join/shared_invite/zt-g8lpruog-HeqpgYrwdfrD5OYhlU7hPQ#/',
    'Slack',
    'interact with other Superset users and community members',
  ],
  [
    'https://github.com/apache/incubator-superset',
    'Github',
    'create tickets to report issues, report bugs, and suggest new features',
  ],
  [
    'https://lists.apache.org/list.html?dev@superset.apache.org',
    'Mailing list',
    'receive up-to-date news and announcements on all things Superset',
  ],
  [
    'https://stackoverflow.com/questions/tagged/superset+apache-superset',
    'Stack Overflow',
    'get help with Superset issues',
  ],
  [
    'https://www.meetup.com/Global-Apache-Superset-Community-Meetup/',
    'Superset Meetup group',
    'join our monthly virtual meetups and register for any upcoming events',
  ],
  [
    'https://github.com/apache/incubator-superset/blob/master/INTHEWILD.md',
    'Organizations',
    'a list of some of the organizations using Superset in production',
  ],
];

const titleContainer = css`
  text-align: center;
  background: #fff;
  padding-bottom: 200px;
`;

const title = css`
  margin-top: 150px;
  font-size: 60px;
`;

const communityContainer = css`
  display: flex;
  flex-wrap: wrap;
  justify-content: space-around;
  max-width: 1000px;
  margin: 0 auto;
  overflow: auto;
  .communityCard {
    margin: 10px 20px;
    .ant-card-meta-title {
      text-overflow: clip;
      white-space: normal;
      font-size: 13px;
    }
  }
`;

const getInvolvedContainer = css`
  padding: 40px 0;
  margin-bottom: 25px;
  .resources {
    display: block;
    font-size: 15px;
    margin: 20px 0;
    text-align: left;
  }
  .title {
    font-size: 45px;
  }
  .section {
    border-top: 1px solid #ccc;
    max-width: 800px;
    margin: 0 auto;
    padding: 30px 0;
    border-bottom: 1px solid #ccc;
  }
  .ppm {
    margin-top: 100px;
    margin-bottom: 100px;
  }
`;

const Community = () => {
  const pmcList = pmc.map((e) => {
    const name = e.name.indexOf(' ');
    return (
      <a href={e.github} target="_blank" rel="noreferrer" key={name}>
        <Card
          className="communityCard"
          hoverable
          style={{ width: '140px' }}
          size="small"
          cover={<img alt="example" src={e.image} />}
        >
          <GithubOutlined />
          <Meta title={e.name} />
        </Card>
      </a>
    );
  });
  return (
    <Layout>
      <SEO title="Community" />
      <div css={titleContainer}>
        <h1 css={title}>Community</h1>
        <h2>
          The community has many active members who support each other in
          solving problems
        </h2>
        <div css={getInvolvedContainer}>
          <div className="joinCommunity section">
            <h2 className="title">Join the Community</h2>
            <span className="resources">
              {links.map(([href, link, post]) => (
                <>
                  <a href={href}>{link}</a>
                  {' '}
                  -
                  {post}
                  {' '}
                  <br />
                </>
              ))}
            </span>
            <br />
            <a
              href="https://github.com/apache-superset/awesome-apache-superset"
              target="_blank"
              rel="noreferrer"
            >
              <Button type="primary" size="large">
                Additional resources
              </Button>
            </a>
          </div>
          <h3 className="title ppm">Apache Committers</h3>
          <div css={communityContainer}>{pmcList}</div>
        </div>
      </div>
    </Layout>
  );
};

export default Community;
