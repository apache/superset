/* istanbul ignore file */

import React from 'react'

// Token pagination behaves a bit different from
// index based pagination. This hook aids in that process.

export const useTokenPagination = () => {
  const [pageToken, setPageToken] = React.useState()
  const [nextPageToken, setNextPageToken] = React.useState()
  const [previousPageTokens, setPreviousPageTokens] = React.useState([])
  const [pageIndex, setPageIndex] = React.useState(0)

  // Since we're using pagination tokens intead of index, we need
  // to be a bit clever with page-like navigation here.
  const nextPage = () => {
    setPageIndex(old => old + 1)
    setPreviousPageTokens(old => [...old, pageToken])
    setPageToken(nextPageToken)
  }

  const previousPage = () => {
    setPageIndex(old => old - 1)
    setPreviousPageTokens(old =>
      [...old]
        .reverse()
        .slice(1)
        .reverse()
    )
    setPageToken(previousPageTokens[previousPageTokens.length - 1])
  }

  const resetPagination = () => {
    setPageToken(undefined)
    setPageIndex(0)
    setNextPageToken(undefined)
    setPreviousPageTokens([])
  }

  const canPreviousPage = previousPageTokens.length
  const canNextPage = nextPageToken

  return {
    setNextPageToken,
    pageToken,
    pageIndex,
    previousPage,
    nextPage,
    canPreviousPage,
    canNextPage,
    resetPagination,
  }
}
