import { MANAGE_IDENTITY, type Access } from '../access';
import { t } from '../i18n';
import type { AppDefinition, IdentityStore, PermissionDefinition, RoleDefinition, UserRecord } from '../types';
import { esc } from '../util';

export function createIdentityApp(store: () => IdentityStore | undefined, access: Access): AppDefinition {
  return {
    id: 'airworks.identity',
    title: t('identityAdmin'),
    icon: 'startmenu-user.png',
    accent: '#64549c',
    width: 860,
    height: 560,
    requiredPermissions: [MANAGE_IDENTITY],
    render: ({ host, intent, onIntent }) => {
      let tab: 'users' | 'roles' = intent?.role ? 'roles' : 'users';
      let editing: string | undefined = intent?.user ?? intent?.role;
      let message = '';

      const render = async () => {
        const identity = store();
        if (!identity) { host.innerHTML = `<p class="identity-empty">${t('noIdentityStore')}</p>`; return; }
        const [users, roles, serverPermissions] = await Promise.all([identity.listUsers(), identity.listRoles(), identity.listPermissions()]);
        const permissions = new Map<string, PermissionDefinition>([...access.permissions.values(), ...serverPermissions].map((permission) => [permission.id, permission]));
        const groups = new Map<string, PermissionDefinition[]>();
        permissions.forEach((permission) => groups.set(permission.group ?? '', [...(groups.get(permission.group ?? '') ?? []), permission]));

        const userRow = (user: UserRecord) => editing === user.id ? `
          <tr class="editing" data-user="${esc(user.id)}"><td><input name="userName" value="${esc(user.userName)}" required/></td><td><input name="displayName" value="${esc(user.displayName)}"/></td><td><input name="email" value="${esc(user.email ?? '')}"/></td>
          <td class="checks">${roles.map((role) => `<label><input type="checkbox" name="role" value="${esc(role.id)}" ${user.roles.includes(role.id) ? 'checked' : ''}/>${esc(role.title)}</label>`).join('')}</td>
          <td class="actions"><button data-save>${t('save')}</button><button data-cancel>${t('cancel')}</button></td></tr>`
          : `<tr data-user="${esc(user.id)}"><td>${esc(user.userName)}</td><td>${esc(user.displayName)}</td><td>${esc(user.email ?? '')}</td><td>${user.roles.map((id) => `<i class="tag">${esc(roles.find((role) => role.id === id)?.title ?? id)}</i>`).join('')}</td>
          <td class="actions"><button data-edit>✎</button><button data-delete title="${t('delete')}">×</button></td></tr>`;

        const roleRow = (role: RoleDefinition) => editing === role.id ? `
          <tr class="editing" data-role="${esc(role.id)}"><td><input name="id" value="${esc(role.id)}" required ${roles.some((candidate) => candidate.id === role.id) ? 'readonly' : ''}/></td><td><input name="title" value="${esc(role.title)}"/></td>
          <td class="checks">${[...groups].map(([group, list]) => `<fieldset><legend>${esc(group || '—')}</legend>${list.map((permission) => `<label title="${esc(permission.description ?? permission.id)}"><input type="checkbox" name="permission" value="${esc(permission.id)}" ${role.permissions.includes(permission.id) ? 'checked' : ''}/>${esc(permission.title)}</label>`).join('')}</fieldset>`).join('')}</td>
          <td class="actions"><button data-save>${t('save')}</button><button data-cancel>${t('cancel')}</button></td></tr>`
          : `<tr data-role="${esc(role.id)}"><td>${esc(role.id)}</td><td>${esc(role.title)}</td><td>${role.permissions.map((id) => `<i class="tag" title="${esc(id)}">${esc(permissions.get(id)?.title ?? id)}</i>`).join('')}</td>
          <td class="actions"><button data-edit>✎</button><button data-delete title="${t('delete')}">×</button></td></tr>`;

        const newUser: UserRecord = { id: 'new', userName: '', displayName: '', roles: [] };
        const newRole: RoleDefinition = { id: '', title: '', permissions: [] };
        host.innerHTML = `<div class="identity-app">
          <nav><button data-tab="users" class="${tab === 'users' ? 'selected' : ''}">${t('users')}</button><button data-tab="roles" class="${tab === 'roles' ? 'selected' : ''}">${t('roles')}</button>
          <span class="identity-message">${esc(message)}</span><button data-new>+ ${t(tab === 'users' ? 'newUser' : 'newRole')}</button></nav>
          ${tab === 'users'
            ? `<table><thead><tr><th>${t('userName')}</th><th>${t('displayName')}</th><th>${t('email')}</th><th>${t('roles')}</th><th></th></tr></thead><tbody>${(editing === 'new' ? [newUser, ...users] : users).map(userRow).join('')}</tbody></table>`
            : `<table><thead><tr><th>${t('id')}</th><th>${t('title')}</th><th>${t('permissions')}</th><th></th></tr></thead><tbody>${(editing === '' ? [newRole, ...roles] : roles).map(roleRow).join('')}</tbody></table>`}
        </div>`;
        message = '';

        const act = async (work: () => Promise<void>) => {
          try { await work(); editing = undefined; message = t('saved'); await access.resolve(); } catch (error) { message = String(error); }
          await render();
        };
        host.querySelectorAll<HTMLElement>('[data-tab]').forEach((button) => button.addEventListener('click', () => { tab = button.dataset.tab as typeof tab; editing = undefined; void render(); }));
        host.querySelector('[data-new]')!.addEventListener('click', () => { editing = tab === 'users' ? 'new' : ''; void render(); });
        host.querySelectorAll<HTMLElement>('[data-cancel]').forEach((button) => button.addEventListener('click', () => { editing = undefined; void render(); }));
        host.querySelectorAll<HTMLElement>('tr[data-user], tr[data-role]').forEach((row) => {
          const id = row.dataset.user ?? row.dataset.role!;
          const value = (name: string) => row.querySelector<HTMLInputElement>(`[name="${name}"]`)!.value.trim();
          const checked = (name: string) => [...row.querySelectorAll<HTMLInputElement>(`[name="${name}"]:checked`)].map((input) => input.value);
          row.querySelector('[data-edit]')?.addEventListener('click', () => { editing = id; void render(); });
          row.querySelector('[data-delete]')?.addEventListener('click', () => act(() => row.dataset.user !== undefined ? identity.deleteUser(id) : identity.deleteRole(id)));
          row.querySelector('[data-save]')?.addEventListener('click', () => act(async () => {
            if (row.dataset.user !== undefined) {
              const userName = value('userName');
              if (!userName) throw new Error(`${t('userName')}?`);
              await identity.saveUser({ id: id === 'new' ? userName : id, userName, displayName: value('displayName') || userName, email: value('email') || undefined, roles: checked('role') });
            } else {
              const roleId = value('id');
              if (!roleId) throw new Error(`${t('id')}?`);
              await identity.saveRole({ id: roleId, title: value('title') || roleId, permissions: checked('permission') });
            }
          }));
        });
      };
      onIntent((next) => {
        tab = next.role ? 'roles' : 'users';
        editing = next.user ?? next.role;
        void render();
      });
      void render();
    },
  };
}
