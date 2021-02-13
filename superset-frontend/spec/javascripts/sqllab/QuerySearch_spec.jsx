import React from 'react';
import Button from 'src/components/Button';
import thunk from 'redux-thunk';
import configureStore from 'redux-mock-store'
import fetchMock from 'fetch-mock';
import Select from 'src/components/Select';
import QuerySearch from 'src/SqlLab/components/QuerySearch';
import { Provider } from 'react-redux';
import { supersetTheme, ThemeProvider } from '@superset-ui/core';
import { fireEvent, render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockStore = configureStore([thunk]);
const store = mockStore({})

const SEARCH_ENDPOINT = 'glob:*/superset/search_queries?*';
const USER_ENDPOINT ='glob:*/api/v1/query/related/user';
const DATABASE_ENDPOINT = 'glob:*/api/v1/database/?*';

fetchMock.get(SEARCH_ENDPOINT, []);
fetchMock.get(USER_ENDPOINT, []);
fetchMock.get(DATABASE_ENDPOINT, [])

describe('QuerySearch', ()=> {
    const refresh = jest.fn();
    const mockedProps = {
        actions: { addDangerToast: jest.fn() },
        displayLimit: 50
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

    beforeEach(async()=> {
      // You need this await function in order to change state in the app. In fact you need it everytime you re-render. 
        await act(async()=>{
          render(
              <ThemeProvider theme = {supersetTheme}>
                  <Provider store= {store}>
                      <QuerySearch {...mockedProps} />
                  </Provider>
              </ThemeProvider>        
               );
        })
    })
    
    test('it should have three Selects', () =>{
        // console.log(screen.logTestingPlaygroundURL());
        expect(screen.getByText(/28 days ago/i)).toBeInTheDocument();
        expect(screen.getByText(/now/i)).toBeInTheDocument();
        expect(screen.getByText(/success/i)).toBeInTheDocument();
    })

    test('updates fromTime on user selects from time', async() => {
        const role = screen.getByText(/28 days ago/i);
        fireEvent.keyDown(role, {key: 'ArrowDown', keyCode: 40});
        userEvent.click(screen.getByText(/1 hour ago/i))
        expect(screen.getByText(/1 hour ago/i)).toBeInTheDocument()
      });

      test('updates toTime on user selects on time', ()=> {
        const role = screen.getByText(/now/i);
        fireEvent.keyDown(role, {key: 'ArrowDown', keyCode: 40});
        userEvent.click(screen.getByText(/1 hour ago/i))
        expect(screen.getByText(/1 hour ago/i)).toBeInTheDocument()
      })

      test('updates status on user selects status', ()=> {
        const role = screen.getByText(/success/i);
        fireEvent.keyDown(role, {key: 'ArrowDown', keyCode: 40});
        userEvent.click(screen.getByText(/failed/i))
        expect(screen.getByText(/failed/i)).toBeInTheDocument()
      })

      test('should have one input for searchText', () => {
        expect(screen.getByPlaceholderText(/Query search string/i)).toBeInTheDocument();
      });

      test('updates search text on user inputs search text', () => {
        const search = screen.getByPlaceholderText(/Query search string/i);
        userEvent.type(search, 'text');
        expect(search.value).toBe('text')
      });

      test('should have one Button', ()=> {
          const button = screen.getAllByRole('button')
          expect(button.length).toEqual(1);
      })

      test('should call API when search button is pressed', async ()=>{
        fetchMock.resetHistory();
        const button = screen.getByRole('button');
        await act(async() => {
          userEvent.click(button)
        })
        expect(fetchMock.calls(SEARCH_ENDPOINT)).toHaveLength(1);
      })

      test('should call API when (only)enter key is pressed', async ()=>{
        fetchMock.resetHistory();
        const search = screen.getByPlaceholderText(/Query search string/i);
        await act(async()=>{
          userEvent.type(search, 'a');
        })
        expect(fetchMock.calls(SEARCH_ENDPOINT)).toHaveLength(0);
        await act(async() => {
          userEvent.type(search, '{enter}');        
        })
        expect(fetchMock.calls(SEARCH_ENDPOINT)).toHaveLength(1);
      })
})
