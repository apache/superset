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
import React, { ReactNode } from 'react';
import styled from '@emotion/styled';
import { List } from 'antd';
import Layout from '@theme/Layout';

const communityLinks = [
  {
    url: 'http://bit.ly/join-superset-slack',
    title: 'Slack',
    description: 'Interact with other Superset users and community members.',
    image: 'slack-symbol.png',
  },
  {
    url: 'https://github.com/apache/superset',
    title: 'GitHub',
    description:
      'Create tickets to report issues, report bugs, and suggest new features.',
    image: 'github-symbol.png',
  },
  {
    url: 'https://lists.apache.org/list.html?dev@superset.apache.org',
    title: 'dev@ Mailing List',
    description:
      'Participate in conversations with committers and contributors.',
    image: 'email-symbol.png',
  },
  {
    url: 'https://stackoverflow.com/questions/tagged/superset+apache-superset',
    title: 'Stack Overflow',
    description: 'Our growing knowledge base.',
    image: 'stack-overflow-symbol.png',
  },
  {
    url: 'https://www.meetup.com/Global-Apache-Superset-Community-Meetup/',
    title: 'Superset Meetup Group',
    description:
      'Join our monthly virtual meetups and register for any upcoming events.',
    image: 'coffee-symbol.png',
  },
  {
    url: 'https://github.com/apache/superset/blob/master/RESOURCES/INTHEWILD.md',
    title: 'Organizations',
    description:
      'A list of some of the organizations using Superset in production.',
    image: 'note-symbol.png',
  },
  {
    url: 'https://github.com/apache-superset/awesome-apache-superset',
    title: 'Contributors Guide',
    description:
      'Interested in contributing? Learn how to contribute and best practices.',
    image: 'writing-symbol.png',
  },
];

const StyledBlurredSection = styled('section')`
  text-align: center;
  border-bottom: 1px solid #ededed;
  .blur {
    max-width: 635px;
    width: 100%;
    margin-top: -70px;
    margin-bottom: -35px;
    position: relative;
    z-index: -1;
  }
`;

const StyledSectionHeader = styled('div')`
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding-top: 60px;
  .title {
    font-weight: 700;
    color: var(--ifm-font-base-color);
  }
`;

const StyledSectionHeaderH1 = styled(StyledSectionHeader)`
  .title {
    font-size: 96px;
  }
  .line {
    margin-top: -45px;
    margin-bottom: 15px;
  }
  .subtitle {
    font-size: 30px;
  }
`;

const StyledSectionHeaderH2 = styled(StyledSectionHeader)`
  .title {
    font-size: 48px;
  }
  .line {
    margin-top: -15px;
    margin-bottom: 15px;
  }
  .subtitle {
    font-size: 24px;
  }
`;

const StyledJoinCommunity = styled('section')`
  background-color: #fbfbfb;
  border-bottom: 1px solid #ededed;
  .list {
    max-width: 540px;
    margin: 0 auto;
    padding-top: 40px;
    padding-bottom: 20px;
  }
  .item {
    padding: 0;
    border: 0;
  }
  .icon {
    width: 40px;
    margin-top: 5px;
  }
  .title {
    font-size: 20px;
    font-weight: 700;
    color: var(--ifm-font-base-color);
  }
  .description {
    font-size: 14px;
    line-height: 36px;
    color: #5f5f5f;
    margin-top: -12px;
  }
`;

const StyledCalendarIframe = styled('iframe')`
  display: block;
  margin: 20px auto 30px;
  width: 800px;
  height: 600px;
  border: 0;
`;

const StyledNewsletterIframe = styled('iframe')`
  display: block;
  max-width: 1080px;
  width: 100%;
  height: 285px;
  margin: 15px auto 0;
  border: 0;
`;

interface BlurredSectionProps {
  children: ReactNode;
}

const BlurredSection = ({ children }: BlurredSectionProps) => {
  return (
    <StyledBlurredSection>
      {children}
      <img className="blur" src="img/community/blur.png" alt="Blur" />
    </StyledBlurredSection>
  );
};

interface SectionHeaderProps {
  level: any;
  title: string;
  subtitle?: string;
}

const SectionHeader = ({ level, title, subtitle }: SectionHeaderProps) => {
  const Heading = level;

  const StyledRoot =
    level === 'h1' ? StyledSectionHeaderH1 : StyledSectionHeaderH2;

  return (
    <StyledRoot>
      <Heading className="title">{title}</Heading>
      <img className="line" src="img/community/line.png" alt="Line" />
      {subtitle && <p className="subtitle">{subtitle}</p>}
    </StyledRoot>
  );
};

const Community = () => {
  return (
    <Layout
      title="Community"
      description="Community website for Apache Superset, a data visualization and data exploration platform"
    >
      <main>
        <BlurredSection>
          <SectionHeader
            level="h1"
            title="Community"
            subtitle="Get involved in our welcoming, fast growing community!"
          />
        </BlurredSection>
        <StyledJoinCommunity>
          <List
            className="list"
            itemLayout="horizontal"
            dataSource={communityLinks}
            renderItem={({ url, title, description, image }, index) => (
              <List.Item className="item">
                <List.Item.Meta
                  avatar={
                    <img className="icon" src={`img/community/${image}`} />
                  }
                  title={
                    <a className="title" href={url}>
                      {title}
                    </a>
                  }
                  description={<p className="description">{description}</p>}
                />
              </List.Item>
            )}
          />
        </StyledJoinCommunity>
        <BlurredSection>
          <SectionHeader
            level="h2"
            title="Superset Community Calendar"
            subtitle="Join us for live demos, meetups, discussions, and more!"
          />
          <StyledCalendarIframe
            src="https://calendar.google.com/calendar/embed?src=superset.committers%40gmail.com&ctz=America%2FLos_Angeles"
            frameBorder="0"
            scrolling="no"
          />
        </BlurredSection>
        <BlurredSection>
          <SectionHeader level="h2" title="Newsletter Archive" />
          <StyledNewsletterIframe
            src="http://localhost:8000/embed/newsletter/"
            frameBorder="0"
            scrolling="no"
          />
        </BlurredSection>
      </main>
    </Layout>
  );
};

export default Community;
