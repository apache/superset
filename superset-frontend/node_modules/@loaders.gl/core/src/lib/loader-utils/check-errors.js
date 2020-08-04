export async function checkFetchResponseStatus(response) {
  if (!response.ok) {
    let errorMessage = `fetch failed ${response.status} `;
    try {
      const text = await response.text();
      errorMessage += text;
    } catch (error) {
      // ignore error
    }
    throw new Error(errorMessage);
  }
}

export function checkFetchResponseStatusSync(response) {
  if (!response.ok) {
    throw new Error(`fetch failed ${response.status}`);
  }
}
