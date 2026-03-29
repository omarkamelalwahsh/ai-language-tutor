import XLSX from 'xlsx';

const filePath = 'E:/ai-language-tutor/Data/CEFR Descriptors (2020).xlsx';
const workbook = XLSX.readFile(filePath);
const sheet = workbook.Sheets['English'];

const rawData = XLSX.utils.sheet_to_json(sheet) as any[];

const categories = new Set();
rawData.forEach(row => {
    const cat = row['Scale']; 
    if (cat) categories.add(cat);
});

console.log('Categories Found:');
Array.from(categories).sort().forEach(c => console.log(`- ${c}`));
