// Genera los iconos PNG desde el símbolo de FRENO (requiere sharp). Los PNG ya están incluidos en public/icons.
import sharp from 'sharp';
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#c8f452"/><path d="M10 7h13v4.2H14.4v3.4H21v4.2h-6.6V25H10z" fill="#10130a"/><circle cx="23" cy="22.8" r="2.2" fill="#10130a"/></svg>`;
for (const s of [16, 32, 48, 128]) await sharp(Buffer.from(svg), { density: 600 }).resize(s, s).png().toFile(`public/icons/icon${s}.png`);
console.log('Iconos generados');
