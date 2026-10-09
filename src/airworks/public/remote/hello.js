export default function render({ host, access, onClose }) {
  const started = new Date();
  const timer = setInterval(() => {
    host.querySelector('output').textContent = `${Math.round((Date.now() - started) / 1000)} s`;
  }, 1000);
  onClose(() => clearInterval(timer));
  return `<div style="padding:16px">
    <h2 style="margin-top:0">Hello from a remote module</h2>
    <p>Loaded from <code>remote/manifest.json</code> at runtime.</p>
    <p>Signed in as: <strong>${access.identity?.displayName ?? 'guest'}</strong></p>
    <p>Open for <output>0 s</output></p>
  </div>`;
}
