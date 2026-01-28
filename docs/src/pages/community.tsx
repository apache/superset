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
import Layout from '@theme/Layout';
import { mq } from '../utils';
import SectionHeader from '../components/SectionHeader';
import BlurredSection from '../components/BlurredSection';

interface CommunityLink {
  url: string;
  title: string;
  description: string;
  image: string;
}

const communityLinks: CommunityLink[] = [
  {
    url: 'http://bit.ly/join-superset-slack',
    title: 'Slack',
    description: 'Interact with other Superset users and community members.',
    image: 'slack-symbol.jpg',
  },
  {
    url: 'https://github.com/apache/superset',
    title: 'GitHub',
    description:
      'Create tickets to report issues, report bugs, and suggest new features.',
    image: 'github-symbol.jpg',
  },
  {
    url: 'https://lists.apache.org/list.html?dev@superset.apache.org',
    title: 'dev@ Mailing List',
    description:
      'Participate in conversations with committers and contributors. Subscribe by emailing dev-subscribe@superset.apache.org.',
    image: 'email-symbol.png',
  },
  {
    url: 'https://superset.apache.org/inTheWild',
    title: 'Organizations',
    description:
      'A list of some of the organizations using Superset in production.',
    image: 'globe-symbol.svg',
  },
  {
    url: 'https://superset.apache.org/developer_portal/contributing/overview',
    title: 'Contributors Guide',
    description:
      'Interested in contributing? Learn how to contribute and best practices.',
    image: 'writing-symbol.png',
  },
];

interface SocialLink {
  url: string;
  title: string;
  image: string;
}

const socialLinks: SocialLink[] = [
  {
    url: 'https://x.com/ApacheSuperset',
    title: 'X (Twitter)',
    image: 'x-symbol.svg',
  },
  {
    url: 'https://www.linkedin.com/company/apache-superset/',
    title: 'LinkedIn',
    image: 'linkedin-symbol.svg',
  },
  {
    url: 'https://bsky.app/profile/apachesuperset.bsky.social',
    title: 'Bluesky',
    image: 'bluesky-symbol.svg',
  },
];

const StyledCardGrid = styled('div')`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
  max-width: 1000px;
  margin: 0 auto;
  padding: 30px 20px;
  ${mq[2]} {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  ${mq[1]} {
    grid-template-columns: 1fr;
  }
  .card {
    display: flex;
    align-items: flex-start;
    gap: 16px;
    padding: 20px;
    border: 1px solid var(--ifm-border-color);
    border-radius: 10px;
    text-decoration: none;
    color: inherit;
    transition:
      border-color 0.2s,
      box-shadow 0.2s;
    &:hover {
      border-color: var(--ifm-color-primary);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
      text-decoration: none;
      color: inherit;
    }
  }
  .icon {
    width: 40px;
    height: 40px;
    flex-shrink: 0;
  }
  .card-body {
    min-width: 0;
  }
  .title {
    font-size: 18px;
    font-weight: 700;
    color: var(--ifm-font-base-color);
    margin-bottom: 4px;
  }
  .description {
    font-size: 14px;
    line-height: 1.4;
    color: var(--ifm-secondary-text);
  }
`;

const StyledSocialGrid = styled('div')`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
  max-width: 600px;
  margin: 0 auto;
  padding: 30px 20px;
  ${mq[1]} {
    grid-template-columns: 1fr;
    max-width: 300px;
  }
  .card {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 16px 20px;
    border: 1px solid var(--ifm-border-color);
    border-radius: 10px;
    text-decoration: none;
    color: inherit;
    transition:
      border-color 0.2s,
      box-shadow 0.2s;
    &:hover {
      border-color: var(--ifm-color-primary);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
      text-decoration: none;
      color: inherit;
    }
  }
  .icon {
    width: 28px;
    height: 28px;
    flex-shrink: 0;
  }
  .title {
    font-size: 16px;
    font-weight: 700;
    color: var(--ifm-font-base-color);
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
  const [showCalendar, setShowCalendar] = useState(false);

  const toggleCalendar = () => {
    setShowCalendar(!showCalendar);
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
        <section>
          <StyledCardGrid>
            {communityLinks.map(({ url, title, description, image }) => (
              <a
                key={title}
                className="card"
                href={url}
                target="_blank"
                rel="noreferrer"
              >
                <img className="icon" src={`/img/community/${image}`} alt="" />
                <div className="card-body">
                  <div className="title">{title}</div>
                  <div className="description">{description}</div>
                </div>
              </a>
            ))}
          </StyledCardGrid>
        </section>
        <BlurredSection>
          <SectionHeader level="h2" title="Follow Us" />
          <StyledSocialGrid>
            {socialLinks.map(({ url, title, image }) => (
              <a
                key={title}
                className="card"
                href={url}
                target="_blank"
                rel="noreferrer"
              >
                <img className="icon" src={`/img/community/${image}`} alt="" />
                <span className="title">{title}</span>
              </a>
            ))}
          </StyledSocialGrid>
        </BlurredSection>
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
