// Writes "Artist - Title" to nowplaying.txt whenever the track changes.
export default function activate(api) {
  let lastPath = null;
  const write = async (track) => {
    const text = track ? track.displayTitle : '';
    lastPath = await api.files.writeText('nowplaying.txt', text);
  };
  api.player.on('trackchange', write);
  api.player.on('statechange', (s) => { if (s === 'stopped') write(null); });
  api.ui.addMenuItem('Show output file location', async () => {
    if (!lastPath) lastPath = await api.files.writeText('nowplaying.txt', '');
    api.ui.notify(lastPath, 5000);
  });
}
