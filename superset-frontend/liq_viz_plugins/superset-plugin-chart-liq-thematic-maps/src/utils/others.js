// Source: https://stackoverflow.com/questions/105034/how-do-i-create-a-guid-uuid/2117523#2117523
const uuidv4 = () => {
  return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c =>
    (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
  );
}

module.exports = { uuidv4 }