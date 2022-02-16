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
import styled from '@emotion/styled';
import { List } from 'antd';
import Layout from '@theme/Layout';

const links = [
  [
    'https://join.slack.com/t/apache-superset/shared_invite/zt-uxbh5g36-AISUtHbzOXcu0BIj7kgUaw',
    'Slack',
    'interact with other Superset users and community members',
  ],
  [
    'https://github.com/apache/superset',
    'GitHub',
    'create tickets to report issues, report bugs, and suggest new features',
  ],
  [
    'https://lists.apache.org/list.html?dev@superset.apache.org',
    'dev@ Mailing List',
    'participate in conversations with committers and contributors',
  ],
  [
    'https://stackoverflow.com/questions/tagged/superset+apache-superset',
    'Stack Overflow',
    'our growing knowledge base',
  ],
  [
    'https://www.meetup.com/Global-Apache-Superset-Community-Meetup/',
    'Superset Meetup Group',
    'join our monthly virtual meetups and register for any upcoming events',
  ],
  [
    'https://github.com/apache/superset/blob/master/RESOURCES/INTHEWILD.md',
    'Organizations',
    'a list of some of the organizations using Superset in production',
  ],
  [
    'https://github.com/apache-superset/awesome-apache-superset',
    'Contributors Guide',
    'Interested in contributing? Learn how to contribute and best practices',
  ],
];

const StyledMain = styled('main')`
  padding-bottom: 60px;
  padding-left: 16px;
  padding-right: 16px;
  section {
    width: 100%;
    max-width: 800px;
    margin: 0 auto;
    padding: 60px 0 0 0;
    font-size: 17px;
    &:first-of-type{
      padding: 40px;
      background-image: linear-gradient(120deg, #d6f2f8, #52c6e3);
      border-radius: 0 0 10px;
    }
  }
`;

const StyledGetInvolved = styled('div')`
  margin-bottom: 25px;
`;

const Community = () => {
  return (
    <Layout
      title="Community"
      description="Community website for Apache Superset, a data visualization and data exploration platform"
    >
      <StyledMain>
        <section>
          <h1 className="title">Community</h1>
          Get involved in our welcoming, fast growing community!
        </section>
        <section className="joinCommunity">
          <StyledGetInvolved>
            <h2>Get involved!</h2>
            <List
              size="small"
              bordered
              dataSource={links}
              renderItem={([href, link, post]) => (
                <List.Item>
                  <a href={href}>{link}</a>
                  {' '}
                  -
                  {' '}
                  {post}
                </List.Item>
              )}
            />
          </StyledGetInvolved>
        </section>
      </StyledMain>
    </Layout>
  );
};

export default Community;
