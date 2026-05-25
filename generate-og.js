// generate-og.js — gera og-image.png (1200x630)
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

// Dots helper
function dots(cols, rows, x0, y0, gap, r, color, opacity){
  return Array.from({length: rows}, (_, row) =>
    Array.from({length: cols}, (_, col) =>
      `<circle cx="${x0 + col * gap}" cy="${y0 + row * gap}" r="${r}" fill="${color}" opacity="${opacity}"/>`
    ).join('')
  ).join('');
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">

  <!-- Fundo creme quente -->
  <rect width="${W}" height="${H}" fill="#FBF6F1"/>

  <!-- Blob superior esquerdo (rosa claro) -->
  <path d="M 60,-100 C 240,-180 420,-80 380,100 C 340,280 120,320 -40,220 C -200,120 -200,-40 60,-100 Z"
    fill="#F9A8BC" opacity="0.45"/>

  <!-- Blob inferior direito (azul claro) -->
  <path d="M 880,430 C 1010,350 1270,370 1290,520 C 1310,670 1120,730 940,690 C 760,650 750,510 880,430 Z"
    fill="#A8D0E6" opacity="0.48"/>

  <!-- Circulo amarelo superior direito -->
  <circle cx="1072" cy="115" r="54" fill="#FFD66B" opacity="0.78"/>

  <!-- Grid de pontos superior direito -->
  ${dots(5, 4, 958, 52, 38, 4, '#E8557A', '0.2')}

  <!-- Grid de pontos inferior esquerdo -->
  ${dots(3, 4, 72, 488, 38, 4, '#E8557A', '0.28')}

  <!-- Icone: quadrado arredondado coral -->
  <rect x="152" y="168" width="206" height="206" rx="48" fill="#E8557A"/>

  <!-- Cruz branca: barra vertical -->
  <rect x="229" y="206" width="52" height="130" rx="16" fill="white"/>
  <!-- Cruz branca: barra horizontal -->
  <rect x="194" y="241" width="122" height="52" rx="16" fill="white"/>

  <!-- Logo: resumos (escuro) + med (coral) na mesma linha -->
  <text
    x="398" y="308"
    font-family="'Arial Black', 'Arial', 'Helvetica Neue', sans-serif"
    font-size="92" font-weight="900" letter-spacing="-2">
    <tspan fill="#1A1918">resumos</tspan><tspan fill="#E8557A">med</tspan>
  </text>

  <!-- Tagline -->
  <text
    x="402" y="374"
    font-family="'Arial', 'Helvetica Neue', sans-serif"
    font-size="30" fill="#9E9890" letter-spacing="0">O caderno da turma toda, <tspan fill="#E8557A" font-style="italic">agora seu.</tspan></text>

  <!-- Underline curvo sob "agora seu." -->
  <path d="M 790 386 C 840 396 920 392 1040 383"
    stroke="#E8557A" stroke-width="2.8" fill="none" stroke-linecap="round"/>

</svg>`;

const outPath = path.join(__dirname, 'og-image.png');

sharp(Buffer.from(svg))
  .png({ quality: 95, compressionLevel: 8 })
  .resize(W, H)
  .toFile(outPath)
  .then(() => {
    const kb = Math.round(fs.statSync(outPath).size / 1024);
    console.log(`ok og-image.png gerada (${kb} KB)`);
  })
  .catch(err => {
    console.error('Erro:', err.message);
    process.exit(1);
  });
