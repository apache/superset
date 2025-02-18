const fs = require('fs-extra');
const path = require('path');

const CONFIG_FILENAME = '../diagrams/config.json';
const configFilePath = path.resolve(__dirname, CONFIG_FILENAME);

// Read the JSON file and parse it
const readJsonFile = (filePath) => {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`Error reading JSON file: ${error.message}`);
    process.exit(1);
  }
};

// Extract variables (only variable names like 'customer__person', 'localOne__sys', etc.)
const extractVariablesFromPuml = (filePath) => {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const systemRegex = /System\(([^,]+),/g;
    const extSystemRegex = /System_Ext\(([^,]+),/g;
    const personRegex = /Person\(([^,]+),/g;
    const relationRegex = /\(([^,]+),\s*([^,]+),/g;

    const variables = [];

    // Extract system and external system variables (e.g., localOne__sys, stripe__ext_sys)
    let match;
    while ((match = systemRegex.exec(content)) !== null) {
      variables.push(match[1]);
    }
    while ((match = extSystemRegex.exec(content)) !== null) {
      variables.push(match[1]);
    }

    // Extract person variables (e.g., customer__person, restaurant_manager__person)
    while ((match = personRegex.exec(content)) !== null) {
      variables.push(match[1]);
    }

    // Extract variables from relations (e.g., customer__person, localOne__sys)
    while ((match = relationRegex.exec(content)) !== null) {
      variables.push(match[1]);
      variables.push(match[2]);
    }

    return variables;
  } catch (error) {
    console.error(`Error reading PUML file: ${error.message}`);
    process.exit(1);
  }
};

// Sanitize the extracted variables
const sanitizeVariablesFromPuml = (variables) => {
  return variables.filter(s => s.split('"').length === 1);
};

// Validate the system and person definitions (System, System_Ext, Person) and relations in a single pass
const validateDefinitionsAndRelations = (pumlFileName) => {
  const pumlFilePath = path.resolve(__dirname, `../diagrams/${pumlFileName}`);

  const config = readJsonFile(configFilePath);

  // Combine system and person keys into a single valid key list
  const validSystemKeys = Object.values(config.system).map((sys) => sys.key);
  const validPersonKeys = Object.values(config.person).map((person) => person.key);

  const pumlVariablesNotSanitized = extractVariablesFromPuml(pumlFilePath);
  const pumlVariables = sanitizeVariablesFromPuml(pumlVariablesNotSanitized);

  let errorFound = false;
  let errorsCount = 0;
  const pumlContent = fs.readFileSync(pumlFilePath, 'utf-8');
  const lines = pumlContent.split('\n');

  // Track errors for both definitions and relations globally
  const reportedErrors = new Set();

  // Check variables in system/person definitions and relations
  pumlVariables.forEach((variable) => {
    // Check if the variable is in the valid system or person keys
    if (
      (!validSystemKeys.includes(variable) && !validPersonKeys.includes(variable)) &&
      !reportedErrors.has(variable)
    ) {
      errorFound = true;
      errorsCount++;

      // Search for the variable in the PUML content and report the error
      lines.forEach((line, index) => {
        if (line.includes(variable)) {
          console.error(`  Error: Variable "${variable}" not found in ${CONFIG_FILENAME} (file: ${pumlFileName}; line ${index + 1})`);
          reportedErrors.add(variable); // Track this error
        }
      });
    }
  });

  if (!errorFound) {
    console.log('  All variables are valid.');
  }

  return errorsCount;
};

// Validate multiple UML files
const validateUMLFiles = (fileNames) => {
  for (let i = 0; i < fileNames.length; i++) {
    console.log();
    console.log();
    console.log(`Validating file: ${fileNames[i]} (${i + 1} out of ${fileNames.length})`);
    console.log();
    const errorsCount = validateDefinitionsAndRelations(fileNames[i]);
    console.log();
    console.log('Validation finished. Errors found:', errorsCount);
    console.log();
    console.log();
    console.log('----------');
  }
};

module.exports = { validateUMLFiles };
