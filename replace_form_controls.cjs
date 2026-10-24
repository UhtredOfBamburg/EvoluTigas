const fs = require('fs');

function replaceInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  // Regex to remove the components
  const regex = /const SelectField[\s\S]*?};\n};\n/m;
  const match = content.match(/const SelectField[\s\S]*?<\/Card>\n  \);\n};\n/m);
  
  if (match) {
    content = content.replace(match[0], '');
    
    // Add import statement
    const importStatement = "import { SelectField, ToggleButtons, MultiSelectButtons, SectionCard } from '@/components/FormControls';\n";
    content = content.replace("import React, { useState } from 'react';", "import React, { useState } from 'react';\n" + importStatement);
    
    fs.writeFileSync(filePath, content);
    console.log('Replaced in ' + filePath);
  } else {
    console.log('Not found in ' + filePath);
  }
}

replaceInFile('src/pages/Ambulatorio.tsx');
