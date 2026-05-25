const fs = require('fs');

const fileBuffer = fs.readFileSync('public/humanoid+robot+3d+model.glb');
const chunkLength = fileBuffer.readUInt32LE(12);
const jsonText = fileBuffer.slice(20, 20 + chunkLength).toString('utf8');
const gltf = JSON.parse(jsonText);

console.log('GLTF JSON keys:', Object.keys(gltf));
if (gltf.accessors) {
  console.log('Accessors count:', gltf.accessors.length);
  // Find accessors representing POSITION
  if (gltf.meshes && gltf.meshes[0] && gltf.meshes[0].primitives && gltf.meshes[0].primitives[0]) {
    const prim = gltf.meshes[0].primitives[0];
    console.log('Primitive attributes:', prim.attributes);
    const posAccessorIdx = prim.attributes.POSITION;
    if (posAccessorIdx !== undefined) {
      const accessor = gltf.accessors[posAccessorIdx];
      console.log('POSITION accessor details:', accessor);
      console.log('Vertex Count:', accessor.count);
    }
  }
}
