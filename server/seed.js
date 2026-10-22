import { db } from './db.js';

console.log('🔄 Resetting Bondtex Production Database to default seed data...');
const result = db.reset();
console.log(`✅ Success! Seeded ${result.count} production orders across Loop, Strap, T-shirt, and Other.`);
process.exit(0);
