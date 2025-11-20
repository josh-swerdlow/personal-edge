import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const animals = {
  bee: '🐝',
  duck: '🦆',
  cow: '🐄',
  rabbit: '🐰',
  dolphin: '🐬',
  squid: '🦑'
};

const disciplines = ['jump', 'spins', 'edges'];
const sections = ['theory', 'reminders', 'troubleshooting'];

const baseDir = path.join(__dirname, '..', 'public', 'deck-icons');

// Create SVG content for each combination
function createSVG(animal, discipline, section) {
  const emoji = animals[animal];
  const label = `${animal}/${discipline}/${section}`;

  return `<svg width="64" height="64" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
  <rect width="64" height="64" fill="#f0f0f0" stroke="#ccc" stroke-width="2" rx="4"/>
  <text x="32" y="38" font-family="Arial, sans-serif" font-size="24" text-anchor="middle" fill="#666">${emoji}</text>
  <text x="32" y="55" font-family="Arial, sans-serif" font-size="6" text-anchor="middle" fill="#999">${label}</text>
</svg>`;
}

// Generate all icon files
for (const animal of Object.keys(animals)) {
  for (const discipline of disciplines) {
    for (const section of sections) {
      const dir = path.join(baseDir, animal, discipline, section);
      const filePath = path.join(dir, 'icon.svg');

      // Ensure directory exists
      fs.mkdirSync(dir, { recursive: true });

      // Write SVG file
      fs.writeFileSync(filePath, createSVG(animal, discipline, section));
      console.log(`Created: ${filePath}`);
    }
  }
}

console.log('All deck icons generated!');

