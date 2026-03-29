import XLSX from 'xlsx';

const filePath = 'E:/ai-language-tutor/Data/CEFR Descriptors (2020).xlsx';
const workbook = XLSX.readFile(filePath);
const sheet = workbook.Sheets['English'];

const rawData = XLSX.utils.sheet_to_json(sheet);
console.log('Total Rows:', rawData.length);
console.log('Columns:', Object.keys(rawData[0] || {}));

// Show first 10 rows to see content categories
console.log('\n--- First 10 Rows ---');
rawData.slice(0, 10).forEach((row, i) => {
  console.log(`Row ${i}:`, row);
});
