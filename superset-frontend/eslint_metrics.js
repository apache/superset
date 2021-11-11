module.exports = results => {
  const byRuleId = results.reduce(
    (map, current) => {
      current.messages.forEach(({ ruleId, line, column }) => {
        if (!map[ruleId]) {
          map[ruleId] = [];
        }

        const occurrence = `${current.filePath}:${line}:${column}`;
        map[ruleId].push(occurrence);
      });
      return map;
    }, {}
  );

  const metricsByRule = Object.entries(byRuleId)
    .map(([ruleId, occurrences]) => `
    {
      "rule": "${ruleId}",
      "count": ${occurrences.length},
      "files": [
      \t"${occurrences.join('",\n\t\t"')}"
      ]
    }`)
    .join(',\n');

    return `{\n\t"metrics": [\n\t\t\t${metricsByRule}\n\t]\n}`;
};
  

// use via `eslint -f ./eslint_metrics.js`