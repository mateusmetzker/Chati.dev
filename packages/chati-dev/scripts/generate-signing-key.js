/**
 * One-time keypair generation for Ed25519 manifest signing.
 * Run: node scripts/generate-signing-key.js
 *
 * Private key: .signing-key.pem (GITIGNORED — never commit)
 * Public key:  src/installer/signing-public-key.pem (committed — distributed with package)
 */
import { generateKeyPairSync } from 'crypto';
import { writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const privateKeyPath = join(__dirname, '..', '.signing-key.pem');
const publicKeyPath = join(__dirname, '..', 'src', 'installer', 'signing-public-key.pem');

if (existsSync(privateKeyPath)) {
  console.error('Private key already exists at .signing-key.pem');
  console.error('Delete it first if you want to regenerate.');
  process.exit(1);
}

const { publicKey, privateKey } = generateKeyPairSync('ed25519', {
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

writeFileSync(privateKeyPath, privateKey);
writeFileSync(publicKeyPath, publicKey);

console.log('Ed25519 keypair generated.');
console.log(`  Private: .signing-key.pem (GITIGNORED)`);
console.log(`  Public:  src/installer/signing-public-key.pem`);
