import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(__dirname, '../../.env.test') });

export async function setup() {
  console.log('Integration test setup starting...');
  console.log('Ensure Docker containers are running: pnpm test:setup');
}

export async function teardown() {
  console.log('Integration test teardown...');
}
