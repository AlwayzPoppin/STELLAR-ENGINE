const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'components', 'Viewport.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const targetSignature = 'function ParticleEmitter({ type, isPlaying, particleProps }: { type: string; isPlaying: boolean; particleProps?: SceneObject[\'particleProps\'] }) {';
const startIndex = content.indexOf(targetSignature);

if (startIndex === -1) {
  console.error("Could not find ParticleEmitter signature in Viewport.tsx!");
  process.exit(1);
}

const beforeSignature = content.substring(0, startIndex);
const newEmitter = fs.readFileSync(path.join(__dirname, 'new_emitter.txt'), 'utf8');

const lastBraceIndex = content.lastIndexOf('}');
const afterEmitter = content.substring(lastBraceIndex + 1);

const finalContent = beforeSignature + newEmitter + '\n' + afterEmitter;

fs.writeFileSync(filePath, finalContent, 'utf8');
console.log("Successfully replaced ParticleEmitter with the cinema-grade version!");
