// generate-og.js — gera og-image.png (1200x630) sem dependência prévia
// Uso: node generate-og.js

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

try { require.resolve('sharp'); }
catch(e) {
  console.log('Instalando sharp…');
  execSync('npm install sharp --no-save', { stdio: 'inherit', cwd: __dirname });
}

const sharp = require('sharp');

const W = 1200, H = 630;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <!-- Gradiente de fundo quente -->
    <radialGradient id="blob1" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#FF6B5B" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="#FF6B5B" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="blob2" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#B5A6F0" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="#B5A6F0" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="blob3" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#6FB6E0" stop-opacity="0.2"/>
      <stop offset="100%" stop-color="#6FB6E0" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <!-- Fundo base -->
  <rect width="${W}" height="${H}" fill="#FAF6EF"/>

  <!-- Blobs decorativos -->
  <ellipse cx="1160" cy="80"  rx="240" ry="240" fill="url(#blob1)"/>
  <ellipse cx="1100" cy="580" rx="180" ry="180" fill="url(#blob2)"/>
  <ellipse cx="60"   cy="500" rx="200" ry="200" fill="url(#blob3)"/>

  <!-- Grade de pontos decorativos (canto direito) -->
  ${Array.from({length:6}, (_,row) =>
    Array.from({length:6}, (_,col) =>
      `<circle cx="${920 + col*36}" cy="${80 + row*36}" r="2.5" fill="#1B1A17" opacity="0.08"/>`
    ).join('')
  ).join('')}

  <!-- Barra lateral coral -->
  <rect x="80" y="190" width="6" height="220" rx="3" fill="#FF6B5B"/>

  <!-- Eyebrow -->
  <text
    x="108" y="222"
    font-family="'Arial', 'Helvetica Neue', sans-serif"
    font-size="15" font-weight="700" letter-spacing="4"
    fill="#FF6B5B" text-anchor="start">RESUMOS DE MEDICINA</text>

  <!-- Logo principal -->
  <text
    x="104" y="328"
    font-family="'Arial Black', 'Arial', 'Helvetica Neue', sans-serif"
    font-size="108" font-weight="900" letter-spacing="-4"
    fill="#1B1A17" text-anchor="start">resumos</text>

  <!-- "med" em coral + itálico -->
  <text
    x="104" y="416"
    font-family="Georgia, 'Times New Roman', serif"
    font-size="108" font-weight="700" font-style="italic" letter-spacing="-2"
    fill="#FF6B5B" text-anchor="start">med</text>

  <!-- Tagline -->
  <text
    x="108" y="474"
    font-family="'Arial', 'Helvetica Neue', sans-serif"
    font-size="24" font-weight="400"
    fill="#6E6A60" text-anchor="start">Resumos enxutos escritos por aluno, pra aluno.</text>

  <!-- Separador -->
  <rect x="108" y="500" width="600" height="1.5" rx="1" fill="#E8E1D4"/>

  <!-- Stats -->
  <text x="108" y="540"
    font-family="'Arial', 'Helvetica Neue', sans-serif"
    font-size="20" font-weight="700" fill="#1B1A17">A partir de R$ 29</text>

  <text x="280" y="540"
    font-family="'Arial', 'Helvetica Neue', sans-serif"
    font-size="20" fill="#DDD3BF">·</text>

  <text x="298" y="540"
    font-family="'Arial', 'Helvetica Neue', sans-serif"
    font-size="20" font-weight="700" fill="#1B1A17">Acesso vitalício</text>

  <text x="488" y="540"
    font-family="'Arial', 'Helvetica Neue', sans-serif"
    font-size="20" fill="#DDD3BF">·</text>

  <text x="506" y="540"
    font-family="'Arial', 'Helvetica Neue', sans-serif"
    font-size="20" font-weight="700" fill="#1B1A17">Leitor protegido</text>

  <!-- URL no canto inferior direito -->
  <text x="1120" y="588"
    font-family="'Arial', 'Helvetica Neue', sans-serif"
    font-size="16" font-weight="500" letter-spacing="1"
    fill="#6E6A60" text-anchor="end">resumosmed.com</text>

  <!-- Ícones médicos minimalistas -->
  <!-- Cruz coral -->
  <g transform="translate(980, 270)">
    <rect x="-9"  y="-30" width="18" height="60" rx="6" fill="#FF6B5B" opacity="0.22"/>
    <rect x="-30" y="-9"  width="60" height="18" rx="6" fill="#FF6B5B" opacity="0.22"/>
  </g>
  <!-- Pilula mint -->
  <g transform="translate(1068, 368) rotate(-35)">
    <rect x="-14" y="-40" width="28" height="80" rx="14" fill="none" stroke="#7BC47F" stroke-width="5" opacity="0.5"/>
    <rect x="-14" y="-4"  width="28" height="4"  fill="#7BC47F" opacity="0.35"/>
  </g>
  <!-- Coracao amarelo -->
  <g transform="translate(940, 400) scale(0.75)">
    <path d="M0,-20 C0,-35 -25,-35 -25,-15 C-25,5 0,25 0,25 C0,25 25,5 25,-15 C25,-35 0,-35 0,-20 Z"
      fill="#FFD66B" opacity="0.55"/>
  </g>
  <!-- Circulo lavanda -->
  <circle cx="1130" cy="460" r="28" fill="none" stroke="#B5A6F0" stroke-width="5" opacity="0.45"/>
  <!-- Circulo sky -->
  <circle cx="900"  cy="200" r="18" fill="#6FB6E0" opacity="0.25"/>
</svg>`;

const outPath = path.join(__dirname, 'og-image.png');

sharp(Buffer.from(svg))
  .png({ quality: 95, compressionLevel: 8 })
  .resize(W, H)
  .toFile(outPath)
  .then(() => {
    const kb = Math.round(fs.statSync(outPath).size / 1024);
    console.log(`✓ og-image.png gerada em ${outPath} (${kb} KB)`);
  })
  .catch(err => {
    console.error('Erro ao gerar imagem:', err.message);
    process.exit(1);
  });
