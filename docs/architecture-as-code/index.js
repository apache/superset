const { validateUMLFiles } = require('./utils/helpers.js');  // Assuming the script is in validateUML.js

const fs = require('fs');
const path = require('path');

// Path to the 'diagrams' folder
const diagramsFolderPath = path.resolve(__dirname, 'diagrams');

// Function to get all .puml filenames from the diagrams folder
const getUmlFiles = () => {
  try {
    // Read the files in the diagrams folder
    const files = fs.readdirSync(diagramsFolderPath);

    // Filter files to include only .puml files
    const umlFiles = files.filter(file => file.endsWith('.puml'));

    return umlFiles;
  } catch (error) {
    console.error(`Error reading diagrams folder: ${error.message}`);
    process.exit(1);
  }
};

const umlFiles = getUmlFiles();
validateUMLFiles(umlFiles);
