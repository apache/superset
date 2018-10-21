// This function returns a promise that resolves to the value
// of the passed response blob. It assumes the blob should be read as text,
// and that the response can be parsed as JSON. This is needed to read
// the value of any fetch-based response.
export default function readResponseBlob(blob) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(JSON.parse(reader.result));
    reader.readAsText(blob);
  });
}
