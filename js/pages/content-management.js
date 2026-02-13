/**
 * Content management page: project list, add/delete, storage.
 */
import { escapeHtml, CMS_PROJECT_PREFIX, init } from '../core.js';
import { getProjectList, saveProjectList, deleteProjectFromIDB } from '../storage.js';

function renderList() {
    const list = getProjectList();
    const ul = document.getElementById('projectList');
    ul.innerHTML = list.map(p => `
        <li>
            <span class="name">${escapeHtml(p.name)}</span>
            <div class="actions">
                <a href="project-edit.html?id=${p.id}" class="edit-link">Edit</a>
                <button type="button" class="delete-btn" title="Delete project" data-project-id="${p.id}" data-project-name="${escapeHtml(p.name)}">&#128465;</button>
            </div>
        </li>
    `).join('');
    ul.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const id = btn.dataset.projectId;
            const name = btn.dataset.projectName || ('Project ' + id);
            if (!confirm('Delete project "' + name + '"? This will remove the project and all its content. This cannot be undone.')) return;
            const list = getProjectList().filter(p => String(p.id) !== String(id));
            saveProjectList(list);
            try { localStorage.removeItem(CMS_PROJECT_PREFIX + id); } catch (e) {}
            renderList();
            deleteProjectFromIDB(id).catch(() => {});
        });
    });
}

document.getElementById('addProjectBtn').addEventListener('click', () => {
    const list = getProjectList();
    const nextId = list.length ? Math.max(...list.map(p => p.id)) + 1 : 1;
    list.push({ id: nextId, name: `Project ${nextId}` });
    saveProjectList(list);
    window.location.href = `project-edit.html?id=${nextId}`;
});

renderList();
init();
