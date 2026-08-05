const fs = require('fs');
const p = JSON.parse(fs.readFileSync('testsprite_tests/testsprite_frontend_test_plan.json', 'utf8'));

console.log('Is array:', Array.isArray(p));
console.log('Top-level keys:', Object.keys(p));

let cases = [];
if (Array.isArray(p)) cases = p;
else cases = p.tests || p.testPlan || p.test_cases || p.cases || p.items || [];

console.log('Test case count:', cases.length);
console.log('========================================');

cases.forEach((c, i) => {
  const id = c.id || c.testId || c.name || c.title || ('case-' + i);
  const title = c.title || c.name || c.description || c.scenario || '';
  const pri = c.priority || c.severity || '';
  console.log(`${i + 1}. [${pri}] ${id} :: ${title}`);
  const steps = c.steps || c.actions || c.test_steps || [];
  if (steps.length) {
    steps.slice(0, 4).forEach((s, j) => {
      const desc = typeof s === 'string' ? s : (s.action || s.description || s.step || JSON.stringify(s));
      console.log(`     ${j + 1}) ${String(desc).slice(0, 90)}`);
    });
    if (steps.length > 4) console.log(`     ... +${steps.length - 4} more steps`);
  }
});

console.log('========================================');
console.log('First case full dump:');
console.log(JSON.stringify(cases[0], null, 2).slice(0, 1200));
