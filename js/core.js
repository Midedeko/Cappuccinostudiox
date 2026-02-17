/**
 * Shared constants, helpers, and global init.
 */
import './pageTransition.js';

export const IDB_NAME = 'PortfolioCMS';
export const IDB_STORE = 'projects';
export const CMS_PROJECT_PREFIX = 'cms_project_';
export const CMS_LIST_KEY = 'cms_project_list';

const PAGES_WITH_MENU_CAROUSEL = ['index.html', 'kitchen.html', 'project-files.html', 'admin.html', '3d-cabinet.html'];

export function escapeHtml(s) {
    if (s == null) return '';
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
}

export function getPageName() {
    return window.location.pathname.split('/').pop() || 'index.html';
}

/**
 * Global init: detect page type, init menus, init animations (carousel), load project if project page.
 * Call from each page script after page-specific setup.
 * @param {object} [options]
 * @param {object} [options.projectPage] - Required for project.html: { projectId, state, runAfterLoad }
 * @param {function} [options.onReady] - Called when menu/carousel init is done (for first-visit loading on landing/kitchen/admin).
 */
export function init(options = {}) {
    const pageName = getPageName();

    if (pageName === 'project.html') {
        const projectPage = options.projectPage;
        if (!projectPage || !projectPage.projectId || !projectPage.state || typeof projectPage.runAfterLoad !== 'function') {
            return;
        }
        const { projectId, state, runAfterLoad } = projectPage;
        import('./storage.js')
            .then(({ getProject }) => getProject(projectId))
            .then(data => {
                if (data) {
                    return import('./projectRenderer.js').then(({ applyCmsData }) => {
                        applyCmsData(data, state, projectId);
                    });
                }
            })
            .finally(runAfterLoad);
        return;
    }

    if (PAGES_WITH_MENU_CAROUSEL.includes(pageName)) {
        Promise.all([import('./loadingScreen.js'), import('./ui.js')]).then(([_, ui]) => {
            const { setupMenuAnimated, initCarousel, carouselSets, pageCarouselSets } = ui;
            setupMenuAnimated('menuContainer', 'menuButton');
            initCarousel('carouselTrack', { carouselSets, pageCarouselSets });
            if (typeof options.onReady === 'function') options.onReady();
        });
    }
}
