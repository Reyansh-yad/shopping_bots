import fs from 'fs';

function readGLB(filePath) {
  const buffer = fs.readFileSync(filePath);
  const magic = buffer.readUInt32LE(0);
  if (magic !== 0x46546C67) { console.log('Not a GLB:', filePath); return; }
  const chunkLength = buffer.readUInt32LE(12);
  const chunkType = buffer.readUInt32LE(16);
  if (chunkType !== 0x4E4F534A) { console.log('No JSON chunk'); return; }
  const json = JSON.parse(buffer.slice(20, 20 + chunkLength).toString('utf8'));

  console.log('\n=== ' + filePath + ' ===');
  console.log('\nMATERIALS:');
  if (json.materials) {
    json.materials.forEach((m, i) => {
      const base = m.pbrMetallicRoughness?.baseColorFactor;
      const texRef = m.pbrMetallicRoughness?.baseColorTexture?.index;
      console.log(`  [${i}] name="${m.name || 'unnamed'}" alphaMode=${m.alphaMode||'OPAQUE'} doubleSided=${m.doubleSided||false} baseTex=${texRef ?? 'none'} baseColor=${base ? base.map(v=>v.toFixed(2)).join(',') : 'none'}`);
    });
  } else {
    console.log('  (no materials)');
  }

  console.log('\nMESHES → MATERIAL mapping:');
  if (json.meshes) {
    json.meshes.forEach((mesh, mi) => {
      mesh.primitives?.forEach((prim, pi) => {
        const matIdx = prim.material ?? 'none';
        const matName = matIdx !== 'none' ? (json.materials?.[matIdx]?.name || 'unnamed') : 'none';
        console.log(`  Mesh[${mi}]="${mesh.name||'unnamed'}" prim[${pi}] → mat[${matIdx}]="${matName}"`);
      });
    });
  }
}

readGLB('Frontend/public/models/apple_watch_ultra_2.glb');
