// Theme picker in the hero: swaps the player screenshot.
const THEMES = [
  ['walnut', 'Walnut Hi-Fi', '#5e3b23', '#ffb547'],
  ['midnight', 'Midnight', '#1c1f29', '#2de2c5'],
  ['synthwave', 'Synthwave', '#1d1033', '#ff2e97'],
  ['steel', 'Brushed Steel', '#7e858f', '#3fa9ff'],
  ['chrome', 'Y2K Chrome', '#aeb8cc', '#6a5cff'],
  ['carbon', 'Carbon Racing', '#17191d', '#e10600'],
  ['cassette', 'Cassette', '#eadcbc', '#f26b1d'],
  ['paper', 'Paper Minimal', '#e8e5de', '#1f6feb'],
];
const img = document.getElementById('player');
const box = document.querySelector('.themes');
const root = document.documentElement;

for (const [id, name, base, accent] of THEMES) {
  const pre = new Image(); pre.src = `assets/player-${id}.webp`;
  const b = document.createElement('button');
  b.type = 'button';
  b.setAttribute('aria-pressed', id === 'walnut');
  b.innerHTML = `<i style="background:linear-gradient(135deg, ${base} 50%, ${accent} 50%)"></i>${name}`;
  b.addEventListener('click', () => {
    box.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', x === b));
    root.style.setProperty('--glow', accent);
    img.classList.add('swap');
    setTimeout(() => {
      img.src = pre.src;
      img.alt = `Wavedeck with the ${name} theme: player, equalizer and playlist`;
      img.classList.remove('swap');
    }, 140);
  });
  box.append(b);
}
