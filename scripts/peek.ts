import * as xlsx from 'xlsx';
import path from 'path';

const filePath = path.join(process.cwd(), 'src/data/CEFR Descriptors (2020).xlsx');
const workbook = xlsx.readFile(filePath);

console.log("Sheet names:");
console.log(workbook.SheetNames);

const englishSheet = workbook.Sheets['English'];
if (englishSheet) {
  const json = xlsx.utils.sheet_to_json(englishSheet, { header: 1, defval: null });
  console.log("First row:");
  console.log(json[0]);
  console.log("Second row:");
  console.log(json[1]);
  console.log("Third row:");
  console.log(json[2]);
} else {
  console.log("English sheet not found.");
}
