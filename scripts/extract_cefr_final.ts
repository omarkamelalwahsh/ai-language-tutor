import XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

const filePath = 'E:/ai-language-tutor/Data/CEFR Descriptors (2020).xlsx';
const workbook = XLSX.readFile(filePath);
const sheet = workbook.Sheets['English'];
const rawData = XLSX.utils.sheet_to_json(sheet) as any[];

const result: any = {
  speaking: {},
  writing: {},
  listening: {},
  vocabulary: {}
};

// Map categories to our skills
const scaleToSkill: Record<string, string> = {
  'Overall oral production': 'speaking',
  'Sustained monologue: Describing experience': 'speaking',
  'Sustained monologue: Putting a case (e.g. in a debate)': 'speaking',
  'Addressing audiences': 'speaking',
  'Overall written production': 'writing',
  'Creative writing': 'writing',
  'Reports and essays': 'writing',
  'Overall listening comprehension': 'listening',
  'Listening to audio media and recordings': 'listening',
  'Vocabulary range': 'vocabulary',
  'Vocabulary control': 'vocabulary',
};

rawData.forEach(row => {
  const scale = row['Scale'];
  const level = row['Level'];
  const descriptor = row['Descriptor'];

  const skill = scaleToSkill[scale];
  if (skill && level && descriptor) {
    if (!result[skill][level]) {
      result[skill][level] = {
        skill,
        level,
        capabilityStatements: [],
        signals: [] // Will be populated in service logic
      };
    }
    result[skill][level].capabilityStatements.push(descriptor);
  }
});

const outputDir = 'E:/ai-language-tutor/src/data';
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

fs.writeFileSync(path.join(outputDir, 'cefr-reference.json'), JSON.stringify(result, null, 2));
console.log('Successfully generated src/data/cefr-reference.json');
