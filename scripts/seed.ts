import { initializeDatabase } from '../server/db';
import { seedDemoData } from '../server/seed';

initializeDatabase();
seedDemoData();
console.log('Seed data loaded into SQLite database.');
