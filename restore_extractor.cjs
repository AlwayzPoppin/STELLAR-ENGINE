const fs = require('fs');
const path = require('path');
const readline = require('readline');

let content = fs.readFileSync('C:/Users/wattz/AppData/Roaming/Code/User/History/-1a790c66/e3sU.ts', 'utf8');

const rl = readline.createInterface({
  input: fs.createReadStream('C:/Users/wattz/.gemini/antigravity-ide/brain/7580491e-ee0c-4905-96c4-a088ce754161/.system_generated/logs/transcript.jsonl')
});

let step = 0;
rl.on('line', (line) => {
  step++;
  const obj = JSON.parse(line);
  if (obj.tool_calls) {
    obj.tool_calls.forEach(call => {
      if (call.args && call.args.TargetFile && call.args.TargetFile.includes('AnimationExtractor.ts')) {
        console.log(`Step ${step}: Found edit to AnimationExtractor.ts`);
        try {
          if (call.name === 'replace_file_content') {
            const target = call.args.TargetContent;
            const replacement = call.args.ReplacementContent;
            if (content.includes(target)) {
              content = content.replace(target, replacement);
              console.log(`  Applied replace_file_content successfully!`);
            } else {
              console.log(`  Failed to find target for replace_file_content!`);
            }
          } else if (call.name === 'multi_replace_file_content') {
            // chunks could be string or array
            let chunks = call.args.ReplacementChunks;
            if (typeof chunks === 'string') {
              chunks = JSON.parse(chunks);
            }
            chunks.forEach((chunk, cIdx) => {
              const target = chunk.TargetContent;
              const replacement = chunk.ReplacementContent;
              if (content.includes(target)) {
                content = content.replace(target, replacement);
                console.log(`  Applied multi_replace chunk ${cIdx} successfully!`);
              } else {
                console.log(`  Failed to find target for chunk ${cIdx}!`);
              }
            });
          }
        } catch (e) {
          console.error(`  Error replaying step ${step}:`, e.message);
        }
      }
    });
  }
});

rl.on('close', () => {
  fs.writeFileSync('c:/Users/wattz/stellar-engine/src/utils/AnimationExtractor.ts', content);
  console.log('Replay complete! AnimationExtractor.ts fully restored.');
});
