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
import React, { useEffect, useState } from 'react';
import { Moment } from 'moment';
import withToasts from 'src/components/MessageToasts/withToasts';
import DvtCalendar from 'src/components/DvtCalendar';
import DvtButton from 'src/components/DvtButton';
import {
  StyledDvtWelcome,
  DataContainer,
  CalendarContainer,
} from './dvt-home.module';
import DvtTitleCardList, {
  CardDataProps,
} from 'src/components/DvtTitleCardList';

const cardData: CardDataProps[] = [
  {
    id: 1,
    title: 'Card 1',
    label: 'Label 1',
    description: 'Description 1',
    isFavorite: false,
    link: '/link1',
  },
];

function DvtWelcome() {
  const [openCalendar, setOpenCalendar] = useState<boolean>(true);
  const [calendar, setCalendar] = useState<Moment | null>(null);
  const [favorites, setFavorites] = useState<number[]>([]);
  const [recentData, setRecentData] = useState<CardDataProps[]>([]);
  const [dashboardData, setDashboardData] = useState<CardDataProps[]>([]);
  const [chartData, setChartData] = useState<CardDataProps[]>([]);
  const [savedQueriesData, setSavedQueriesData] = useState<CardDataProps[]>([]);

  const handleSetFavorites = (id: number, isFavorite: boolean) => {
    if (isFavorite) {
      setFavorites(prevFavorites => [...prevFavorites, id]);
    } else {
      setFavorites(prevFavorites =>
        prevFavorites.filter(favoriteId => favoriteId !== id),
      );
    }
  };

  useEffect(() => {
    const fetchRecentData = async () => {
      try {
        const response = await fetch(`/api/v1/chart/`);
        const data = await response.json();
        setRecentData(data);
      } catch (error) {
        console.error('API request failed:', error);
      }
    };

    const fetchDashboardData = async () => {
      try {
        const response = await fetch(`/api/v1/dashboard/`);
        const data = await response.json();
        let resultFormatData = [];

        for (let i = 0; i < data.result.length; i++) {
          const item = data.result[i];
          resultFormatData.push({
            id: item.id,
            title: item.dashboard_title,
            label: item.changed_by_name,
            description: `Modified ${item.changed_on_delta_humanized}`,
            isFavorite: item.published,
            link: item.url,
          });
        }
        setDashboardData(resultFormatData.slice(0, 5));
      } catch (error) {
        console.error('API request failed:', error);
      }
    };

    const fetchChartData = async () => {
      try {
        const response = await fetch(`/api/v1/chart/`);
        const data = await response.json();
        let resultFormatData = [];

        for (let i = 0; i < data.result.length; i++) {
          const item = data.result[i];
          resultFormatData.push({
            id: item.id,
            title: item.slice_name,
            label: item.changed_by_name,
            description: `Modified ${item.created_on_delta_humanized}`,
            isFavorite: item.is_managed_externally,
            link: item.url,
          });
        }
        setChartData(resultFormatData.slice(0, 5));
      } catch (error) {
        console.error('API request failed:', error);
      }
    };

    const fetchSavedQueriesData = async () => {
      try {
        const response = await fetch(`/api/v1/saved_query/`);
        const data = await response.json();
        let resultFormatData = [];

        for (let i = 0; i < data.result.length; i++) {
          const item = data.result[i];
          resultFormatData.push({
            id: item.id,
            title: item.label,
            label: item.description,
            description: `Ran ${item.last_run_delta_humanized}`,
            isFavorite: false,
            link: '',
          });
        }
        setSavedQueriesData(resultFormatData);
      } catch (error) {
        console.error('API request failed:', error);
      }
    };

    fetchRecentData();
    fetchDashboardData();
    fetchChartData();
    fetchSavedQueriesData();
  }, []);

  return (
    <StyledDvtWelcome>
      <DataContainer>
        <DvtTitleCardList
          title="Recents"
          data={cardData}
          setFavorites={handleSetFavorites}
        />

        <DvtTitleCardList
          title="Dashboards"
          data={dashboardData}
          setFavorites={handleSetFavorites}
        />

        <DvtTitleCardList
          title="Charts"
          data={chartData}
          setFavorites={handleSetFavorites}
        />

        <DvtTitleCardList
          title="Saved Queries"
          data={savedQueriesData}
          setFavorites={handleSetFavorites}
        />
      </DataContainer>
      <CalendarContainer>
        {openCalendar ? (
          <DvtCalendar
            isOpen={openCalendar}
            setIsOpen={setOpenCalendar}
            selectedDate={calendar}
            setSelectedDate={date => date && setCalendar(date)}
          />
        ) : (
          <DvtButton
            label="Open Calendar"
            onClick={() => setOpenCalendar(true)}
          />
        )}
      </CalendarContainer>
    </StyledDvtWelcome>
  );
}

export default withToasts(DvtWelcome);
