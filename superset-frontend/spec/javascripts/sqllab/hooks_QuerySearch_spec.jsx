import React from 'react';
import Button from 'src/components/Button';
import thunk from 'redux-thunk';
import configureStore from 'redux-mock-store'
import fetchMock from 'fetch-mock';
import Select from 'src/components/Select';
import QuerySearch from 'src/SqlLab/components/QuerySearch';
import { Provider } from 'react-redux';
import { supersetTheme, ThemeProvider } from '@superset-ui/core';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockStore = configureStore([thunk]);
const store = mockStore({})

const SEARCH_ENDPOINT = 'glob:*/superset/search_queries?*';

fetchMock.get(SEARCH_ENDPOINT, []);

describe('QuerySearch', ()=> {

    const mockedProps = {
        actions: { addDangerToast: jest.fn() },
        height: 0,
        displayLimit: 50,
    };

    test('is valid', () => {
        expect(React.isValidElement(
            <ThemeProvider theme = {supersetTheme}>
                <Provider store = {store}>
                    <QuerySearch {...mockedProps} />
                </Provider>
            </ThemeProvider>
        )
        ).toBe(true);
    });

    beforeEach(()=> {
        render(
            <ThemeProvider theme = {supersetTheme}>
                <Provider store= {store}>
                    <QuerySearch {...mockedProps} />
                </Provider>
            </ThemeProvider>        
        
        );
    })

    test('it should have three Selects', () =>{
        // console.log(screen.logTestingPlaygroundURL());
        screen.getByText(/28 days ago/i)
        screen.getByText(/now/i)
        screen.getByText(/success/i)
    })

    test('updates fromTime on user selects from time', () => {
        userEvent.type(screen.getByText(/28 days ago/i), 0)
        
      });
})