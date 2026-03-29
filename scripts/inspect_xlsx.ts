import XLSX from 'xlsx';
import * as fs from 'fs';

const filePath = 'E:/ai-language-tutor/Data/CEFR Descriptors (2020).xlsx';
const workbook = XLSX.readFile(filePath);

console.log('Sheets:', workbook.SheetNames);

// Peek core sheets
const sheetsToPeek = ['Table 1', 'Table 2', 'Descriptors']; // Guesses
workbook.SheetNames.slice(0, 5).forEach(name => {
  const sheet = workbook.Sheets[name];
  const json = XLSX.utils.sheet_to_json(sheet).slice(0, 3);
  console.log(`\n--- Sheet: ${name} ---`);
  console.log(json);
});
