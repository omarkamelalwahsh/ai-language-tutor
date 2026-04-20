const fs = require('fs');
const path = require('path');

const directory = 'frontend/src';

const replacements = [
  { regex: /\bbg-background\b/g, replacement: 'bg-slate-50 dark:bg-gray-950' },
  { regex: /\bbg-surface\b/g, replacement: 'bg-white dark:bg-gray-900' },
  { regex: /\bborder-border\b/g, replacement: 'border-slate-200 dark:border-gray-800' },
  { regex: /\bbg-surface-hover/g, replacement: 'hover:bg-slate-50 dark:hover:bg-gray-800' },
  
  { regex: /\btext-foreground\/80\b/g, replacement: 'text-slate-800 dark:text-slate-200' },
  { regex: /\btext-foreground\/60\b/g, replacement: 'text-slate-500 dark:text-slate-400' },
  { regex: /\btext-foreground\/40\b/g, replacement: 'text-slate-400 dark:text-slate-500' },
  { regex: /\btext-foreground\b/g, replacement: 'text-slate-900 dark:text-slate-50' },
  
  { regex: /\bbg-muted\b/g, replacement: 'bg-slate-100 dark:bg-slate-800' },
  { regex: /\btext-muted\b/g, replacement: 'text-slate-500 dark:text-slate-400' },
  
  // Specific Indigos to Soft Blue Requested
  { regex: /\btext-indigo-600\b/g, replacement: 'text-blue-600 dark:text-blue-400' },
  { regex: /\bbg-indigo-600\b/g, replacement: 'bg-blue-600 dark:bg-blue-600' },
  { regex: /\bbg-indigo-50\b/g, replacement: 'bg-blue-50 dark:bg-blue-900/30' },
  
  // Transitions
  // { regex: /transition-colors duration-300/g, replacement: 'transition-colors' },

  // Shadows
  { regex: /\bshadow-xl\b/g, replacement: 'shadow-sm dark:shadow-md' },
  { regex: /\bshadow-2xl\b/g, replacement: 'shadow-sm dark:shadow-md' },
  { regex: /\bdrop-shadow-glow\b/g, replacement: 'shadow-sm dark:shadow-md' },
];

function processDirectory(dir) {
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDirectory(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let originalContent = content;
      
      for (const { regex, replacement } of replacements) {
        content = content.replace(regex, replacement);
      }
      
      if (content !== originalContent) {
        fs.writeFileSync(fullPath, content);
        console.log(`Updated: ${fullPath}`);
      }
    }
  }
}

processDirectory(directory);
console.log("Bulk replacement complete.");
