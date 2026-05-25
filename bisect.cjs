const fs = require('fs');
const cp = require('child_process');

if (!fs.existsSync('src_test')) {
  fs.mkdirSync('src_test');
}
fs.copyFileSync('src/index.css', 'src_test/index.css');

const files = fs.readdirSync('src/components').filter(f => f.endsWith('.tsx'));

for (const file of files) {
  console.log(`Testing ${file}...`);
  fs.copyFileSync(`src/components/${file}`, `src_test/${file}`);
  try {
    cp.execSync('npx @tailwindcss/cli -i index.css -o output.css', { cwd: 'src_test', timeout: 5000, stdio: 'ignore' });
    console.log(`[OK] ${file}`);
  } catch (e) {
    console.log(`[FAIL] ${file} crashed or timed out!`);
  }
  fs.unlinkSync(`src_test/${file}`);
}
console.log("Done.");
