# Changelog

## 0.6.0

- Full-screen app launcher: `AirWorks.configure({ launcher: 'overlay' })` (default `'menu'`), switchable under Settings → General. Search (Enter starts the first match), headings per app `group`, arrow keys, focus stays inside (Tab/Shift+Tab), Esc or a click on the backdrop closes it and focus returns to the start button.
- App icons in the launcher and the start menu have a context menu (right click, menu key, long press on touch): Open, Add to desktop.
- Dragging an icon out of the full-screen launcher fades it, so the shortcut lands on the desktop below; a cancelled drag (Esc) brings the launcher back.
- `VERSION` follows the package version (checked by `npm run check`).
