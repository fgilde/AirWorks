const en = {
  startMenu: 'Start menu', search: 'Search', searchPlaceholder: 'Search apps …', pilot: 'Pilot view', showDesktop: 'Show desktop',
  about: 'About', docs: 'Developer documentation', settings: 'Settings', logout: 'Sign out', login: 'Sign in',
  previousWebtop: 'Previous webtop', nextWebtop: 'Next webtop', webtop: 'Webtop', addWebtop: 'Add webtop', deleteWebtop: 'Delete webtop',
  appMenu: 'App menu', minimize: 'Minimize', maximize: 'Maximize', restore: 'Restore', close: 'Close',
  updateLink: 'Update shortcut', createLink: 'Create shortcut', duplicate: 'Duplicate', openInBrowser: 'Open in browser',
  newFolder: 'New folder', closeFolder: 'Close folder', rename: 'Rename', page: 'Page',
  general: 'General', user: 'User', taskbar: 'Taskbar', colors: 'Colors', background: 'Background', effect: 'Effect', customImage: 'Custom image …',
  askBeforeClose: 'Ask before closing the browser tab', startMaximized: 'Start apps maximized', instantPreview: 'Instant taskbar preview',
  overwriteName: 'Overwrite shortcut name on update', restoreWindows: 'Reopen apps on next start', hideTaskbar: 'Auto-hide taskbar', taskbarHint: 'Position and previews adapt together.',
  top: 'Top', right: 'Right', bottom: 'Bottom', left: 'Left', appColors: 'System color', language: 'Language',
  noEffect: 'None', bubbles: 'Bubbles', snow: 'Snow', starfield: 'Starfield',
  displayName: 'Display name', account: 'Account', email: 'Email', roles: 'Roles', permissions: 'Permissions', guest: 'Guest',
  identityAdmin: 'Users & roles', users: 'Users', newUser: 'New user', newRole: 'New role', save: 'Save', delete: 'Delete', cancel: 'Cancel',
  userName: 'User name', id: 'ID', title: 'Title', noIdentityStore: 'No identity store configured.', saved: 'Saved.',
  signInWith: 'Sign in with {0}', signInTitle: 'Sign in to {0}', continueAsGuest: 'Continue as guest', loginFailed: 'Sign-in failed: {0}',
  accessDenied: 'You do not have permission to open {0}.', appLoadFailed: 'The app could not be loaded: {0}',
  apps: 'Apps', content: 'Content', searching: 'Searching …',
  webLink: 'Web link', editWebLink: 'Edit web link', webLinkMissing: 'This web link no longer exists.', embedHint: 'Page stays empty? Some sites do not allow being shown inside other pages.',
  name: 'Name', webAddress: 'Web address', color: 'Color', icon: 'Icon', chooseImage: 'Choose image …', automatic: 'Automatic', ok: 'OK',
  aboutText: 'Browser-native web desktop and micro-frontend shell.', openDocs: 'Open developer documentation', version: 'Version {0}',
};

export type MessageKey = keyof typeof en;

const de: Record<MessageKey, string> = {
  startMenu: 'Startmenü', search: 'Suchen', searchPlaceholder: 'App suchen …', pilot: 'Pilotansicht', showDesktop: 'Desktop anzeigen',
  about: 'Information', docs: 'Entwicklerdokumentation', settings: 'Einstellungen', logout: 'Abmelden', login: 'Anmelden',
  previousWebtop: 'Vorheriger Webtop', nextWebtop: 'Nächster Webtop', webtop: 'Webtop', addWebtop: 'Webtop hinzufügen', deleteWebtop: 'Webtop löschen',
  appMenu: 'App-Menü', minimize: 'Minimieren', maximize: 'Maximieren', restore: 'Wiederherstellen', close: 'Schließen',
  updateLink: 'Verknüpfung aktualisieren', createLink: 'Verknüpfung erstellen', duplicate: 'Duplizieren', openInBrowser: 'Im Browser öffnen',
  newFolder: 'Neuer Ordner', closeFolder: 'Ordner schließen', rename: 'Umbenennen', page: 'Seite',
  general: 'Allgemein', user: 'Benutzer', taskbar: 'Taskleiste', colors: 'Farben', background: 'Hintergrund', effect: 'Effekt', customImage: 'Eigenes Bild …',
  askBeforeClose: 'Vor dem Schließen des Browser-Tabs nachfragen', startMaximized: 'Apps maximiert starten', instantPreview: 'Sofortige Taskleisten-Vorschau',
  overwriteName: 'Verknüpfungsnamen beim Aktualisieren überschreiben', restoreWindows: 'Apps beim nächsten Start wieder öffnen', hideTaskbar: 'Taskleiste automatisch ausblenden', taskbarHint: 'Position und Vorschauen passen sich gemeinsam an.',
  top: 'Oben', right: 'Rechts', bottom: 'Unten', left: 'Links', appColors: 'Systemfarbe', language: 'Sprache',
  noEffect: 'Kein Effekt', bubbles: 'Blasen', snow: 'Schnee', starfield: 'Sternenfeld',
  displayName: 'Anzeigename', account: 'Benutzerkonto', email: 'E-Mail', roles: 'Rollen', permissions: 'Berechtigungen', guest: 'Gast',
  identityAdmin: 'Benutzer & Rollen', users: 'Benutzer', newUser: 'Neuer Benutzer', newRole: 'Neue Rolle', save: 'Speichern', delete: 'Löschen', cancel: 'Abbrechen',
  userName: 'Benutzername', id: 'ID', title: 'Titel', noIdentityStore: 'Kein Identity-Store konfiguriert.', saved: 'Gespeichert.',
  signInWith: 'Mit {0} anmelden', signInTitle: 'Bei {0} anmelden', continueAsGuest: 'Als Gast fortfahren', loginFailed: 'Anmeldung fehlgeschlagen: {0}',
  accessDenied: 'Keine Berechtigung für {0}.', appLoadFailed: 'Die App konnte nicht geladen werden: {0}',
  apps: 'Apps', content: 'Inhalte', searching: 'Suche läuft …',
  webLink: 'Web-Verknüpfung', editWebLink: 'Web-Verknüpfung bearbeiten', webLinkMissing: 'Diese Web-Verknüpfung existiert nicht mehr.', embedHint: 'Seite bleibt leer? Manche Seiten erlauben keine Anzeige in anderen Seiten.',
  name: 'Name', webAddress: 'Webadresse', color: 'Farbe', icon: 'Icon', chooseImage: 'Bild wählen …', automatic: 'Automatisch', ok: 'OK',
  aboutText: 'Browser-nativer Webdesktop und Micro-Frontend-Shell.', openDocs: 'Entwicklerdokumentation öffnen', version: 'Version {0}',
};

const catalogs: Record<string, Partial<Record<MessageKey, string>>> = { en, de };
let locale = navigator.language?.toLowerCase().startsWith('de') ? 'de' : 'en';

export const getLocale = () => locale;
export const setLocale = (value: string) => { locale = value.toLowerCase().split('-')[0]; };
export const addMessages = (language: string, messages: Partial<Record<MessageKey, string>>) => {
  catalogs[language] = { ...catalogs[language], ...messages };
};

export const t = (key: MessageKey, ...args: unknown[]) =>
  (catalogs[locale]?.[key] ?? en[key]).replace(/\{(\d)\}/g, (_, index) => String(args[Number(index)] ?? ''));

export const label = (text: string) => (text in en ? t(text as MessageKey) : text);
