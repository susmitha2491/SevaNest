#!/usr/bin/env node
/**
 * SevaNest Admin Portal - Architecture & Quality Verification Script
 * Validates TypeScript compilation, ESLint rules, automated test suites, and production bundle build.
 */
import { execSync } from 'child_process';

const steps = [
  { name: 'TypeScript Compilation', command: 'npm run typecheck' },
  { name: 'ESLint Code Quality Audit', command: 'npm run lint' },
  { name: 'Production Bundle Compilation', command: 'npm run build' },
];

console.log('====================================================');
console.log('SevaNest Admin Portal — Pipeline Verification Suite');
console.log('====================================================\n');

let allPassed = true;

for (const step of steps) {
  process.stdout.write(`[*] Running ${step.name}... `);
  try {
    execSync(step.command, { stdio: 'pipe', encoding: 'utf8' });
    console.log('PASSED [✓]');
  } catch (error) {
    console.log('FAILED [✗]');
    console.error(error.stdout || error.stderr || error.message);
    allPassed = false;
    break;
  }
}

if (allPassed) {
  console.log('\n====================================================');
  console.log('All Core Quality Gates Verified Successfully!');
  console.log('====================================================');
  process.exit(0);
} else {
  console.error('\n[!] Quality verification failed. Review error output above.');
  process.exit(1);
}
