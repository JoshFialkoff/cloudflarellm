const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'lib', 'magicLinkEmail.js');
const source = fs.readFileSync(filePath, 'utf8');

const requiredFunction = `function titleCaseFacilityType(label) {
  const text = cleanString(label, 80) || "Assisted living";
  return text.replace(/\\b([a-z])/g, (match) => match.toUpperCase());
}`;

if (!source.includes(requiredFunction)) {
  throw new Error(
    'magicLinkEmail titleCaseFacilityType guard failed. Restore the title-casing implementation so facility types render as “Assisted Living”, not “assisted living”.'
  );
}

console.log('✅ magicLinkEmail titleCaseFacilityType guard passed');
