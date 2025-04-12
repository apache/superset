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
import { useState } from 'react';
import styled from '@emotion/styled';
import { List } from 'antd';
import Layout from '@theme/Layout';
import { mq } from '../utils';
import SectionHeader from '../components/SectionHeader';
import BlurredSection from '../components/BlurredSection';

const communityLinks = [
  {
    url: 'http://bit.ly/join-superset-slack',
    title: 'Slack',
    description: 'Interact with other Superset users and community members.',
    image: 'slack-symbol.jpg',
    ariaLabel:
      'Interact with other Superset users and community members on Slack',
  },
  {
    url: 'https://github.com/apache/superset',
    title: 'GitHub',
    description:
      'Create tickets to report issues, report bugs, and suggest new features.',
    image: 'github-symbol.jpg',
    ariaLabel:
      'Create tickets to report issues, report bugs, and suggest new features on Superset GitHub repo',
  },
  {
    url: 'https://lists.apache.org/list.html?dev@superset.apache.org',
    title: 'dev@ Mailing List',
    description:
      'Participate in conversations with committers and contributors.',
    image: 'email-symbol.png',
    ariaLabel:
      'Participate in conversations with committers and contributors on Superset mailing list',
  },
  {
    url: 'https://stackoverflow.com/questions/tagged/apache-superset',
    title: 'Stack Overflow',
    description: 'Our growing knowledge base.',
    image: 'stackoverflow-symbol.jpg',
    ariaLabel: 'See Superset issues on Stack Overflow',
  },
  {
    url: 'https://www.meetup.com/Global-Apache-Superset-Community-Meetup/',
    title: 'Superset Meetup Group',
    description:
      'Join our monthly virtual meetups and register for any upcoming events.',
    image: 'coffee-symbol.png',
    ariaLabel:
      'Join our monthly virtual meetups and register for any upcoming events on Meetup',
  },
  {
    url: 'https://github.com/apache/superset/blob/master/RESOURCES/INTHEWILD.md',
    title: 'Organizations',
    description:
      'A list of some of the organizations using Superset in production.',
    image: 'note-symbol.png',
    ariaLabel: 'See a list of the organizations using Superset in production',
  },
  {
    url: 'https://github.com/apache-superset/awesome-apache-superset',
    title: 'Contributors Guide',
    description:
      'Interested in contributing? Learn how to contribute and best practices.',
    image: 'writing-symbol.png',
    ariaLabel: 'Learn how to contribute and best practices on Superset GitHub',
  },
];

const StyledJoinCommunity = styled('section')`
  background-color: var(--ifm-background-color);
  border-bottom: 1px solid var(--ifm-border-color);
  .list {
    max-width: 540px;
    margin: 0 auto;
    padding: 40px 20px 20px 35px;
  }
  .item {
    padding: 0;
    border: 0;
  }
  .icon {
    width: 40px;
    margin-top: 5px;
    ${mq[1]} {
      width: 40px;
      margin-top: 0;
    }
  }
  .title {
    font-size: 20px;
    line-height: 36px;
    font-weight: 700;
    color: var(--ifm-font-base-color);
    ${mq[1]} {
      font-size: 23px;
      line-height: 26px;
    }
  }
  .description {
    font-size: 14px;
    line-height: 20px;
    color: var(--ifm-font-base-color);
    margin-top: -8px;
    margin-bottom: 23px;
    ${mq[1]} {
      font-size: 17px;
      line-height: 22px;
      color: var(--ifm-primary-text);
      margin-bottom: 35px;
      margin-top: 0;
    }
  }
`;

const StyledCalendarIframe = styled('iframe')`
  display: block;
  margin: 20px auto 30px;
  max-width: 800px;
  width: 100%;
  height: 600px;
  border: 0;
  ${mq[1]} {
    width: calc(100% - 40px);
  }
`;

const StyledLink = styled('a')`
  display: inline-flex;
  align-items: center;
  font-size: 20px;
  font-weight: bold;
  line-height: 1.4;
  margin-top: 12px;
  ${mq[1]} {
    font-size: 18px;
  }
  img {
    width: 24px;
    height: 24px;
    margin-right: 12px;
    ${mq[1]} {
      display: none;
    }
  }
`;

const FinePrint = styled('div')`
  font-size: 14px;
  color: var(--ifm-secondary-text);
`;

const Community = () => {
  const [showCalendar, setShowCalendar] = useState(false); // State to control calendar visibility

  const toggleCalendar = () => {
    setShowCalendar(!showCalendar); // Toggle calendar visibility
  };

  return (
    <Layout
      title="Community"
      description="Community website for Apache Superset™, a data visualization and data exploration platform"
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
            renderItem={({ url, title, description, image, ariaLabel }) => (
              <List.Item className="item">
                <List.Item.Meta
                  avatar={
                    <a
                      className="title"
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={ariaLabel}
                    >
                      <img className="icon" src={`/img/community/${image}`} />
                    </a>
                  }
                  title={
                    <a href={url} target="_blank" rel="noreferrer">
                      <p className="title" style={{ marginBottom: 0 }}>
                        {title}
                      </p>
                    </a>
                  }
                  description={<p className="description">{description}</p>}
                  aria-label="Community link"
                />
              </List.Item>
            )}
          />
        </StyledJoinCommunity>
        <BlurredSection>
          <SectionHeader
            level="h2"
            title="Superset Community Calendar"
            subtitle={
              <>
                Join us for live demos, meetups, discussions, and more!
                <br />
                <StyledLink
                  href="https://calendar.google.com/calendar/u/0/r?cid=superset.committers@gmail.com"
                  target="_blank"
                  rel="noreferrer"
                >
                  <img src="/img/calendar-icon.svg" alt="calendar-icon" />
                  Subscribe to the Superset Community Calendar
                </StyledLink>
                <br />
                <StyledLink onClick={toggleCalendar}>
                  <img src="/img/calendar-icon.svg" alt="calendar-icon" />
                  {showCalendar ? 'Hide Calendar' : 'Display Calendar*'}
                </StyledLink>
                {!showCalendar && (
                  <FinePrint>
                    <sup>*</sup>Clicking on this link will load and send data
                    from and to Google.
                  </FinePrint>
                )}
              </>
            }
          />
          {showCalendar && (
            <StyledCalendarIframe
              src="https://calendar.google.com/calendar/embed?src=superset.committers%40gmail.com&ctz=America%2FLos_Angeles"
              frameBorder="0"
              scrolling="no"
            />
          )}
        </BlurredSection>
      </main>
    </Layout>
  );
};

export default Community;
