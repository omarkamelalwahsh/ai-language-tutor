import * as xlsx from 'xlsx';
import path from 'path';
import fs from 'fs';

const excelFilePath = path.join(process.cwd(), 'src/data/CEFR Descriptors (2020).xlsx');
const outputJsonPath = path.join(process.cwd(), 'src/data/cefr-descriptors.json');

type CEFRDescriptor = {
  id: string;
  scheme: string;
  mode: string;
  activity: string;
  scale: string;
  level: string;
  descriptor: string;
};

function normalizeExcel() {
  if (!fs.existsSync(excelFilePath)) {
    console.error(`Excel file not found at ${excelFilePath}`);
    return;
  }

  console.log('Reading Excel file...');
  const workbook = xlsx.readFile(excelFilePath);
  
  const sheetName = workbook.SheetNames.includes('English') ? 'English' : workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  // Convert to JSON
  const rawData = xlsx.utils.sheet_to_json(sheet) as any[];

  console.log(`Parsed ${rawData.length} rows.`);

  const normalizedData: CEFRDescriptor[] = [];

  for (let i = 0; i < rawData.length; i++) {
    const row = rawData[i];
    
    // Normalize keys since Excel headers can have spaces
    const getVal = (possibleKeys: string[]) => {
      for (const key of possibleKeys) {
        if (row[key] !== undefined) return row[key];
        // try case insensitive
        const found = Object.keys(row).find(k => k.toLowerCase().includes(key.toLowerCase()));
        if (found) return row[found];
      }
      return '';
    };

    const scheme = getVal(['CEFR Descriptor Scheme', 'Scheme']);
    const mode = getVal(['Mode of communication', 'Mode']);
    const activity = getVal(['Activity, strategy', 'Activity']);
    const scale = getVal(['Scale']);
    const level = getVal(['Level']);
    const descriptor = getVal(['Descriptor']);

    if (level && descriptor) {
      normalizedData.push({
        id: `desc-${i}`,
        scheme: String(scheme).trim(),
        mode: String(mode).trim(),
        activity: String(activity).trim(),
        scale: String(scale).trim(),
        level: String(level).trim(),
        descriptor: String(descriptor).trim(),
      });
    }
  }

  console.log(`Found ${normalizedData.length} valid descriptors.`);
  
  fs.writeFileSync(outputJsonPath, JSON.stringify(normalizedData, null, 2));
  console.log(`Written parsed dataset to ${outputJsonPath}`);
}

normalizeExcel();
