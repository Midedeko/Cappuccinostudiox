/**
 * Project Files page: 3D box with iso cards; init() handles menu and carousel.
 * Card links use project list ids (URL ?id=).
 */
import { init } from '../core.js';
import { getProjectList } from '../storage.js';

window.addEventListener('DOMContentLoaded', () => {
    init();
    const projectList = getProjectList();
    const projectIds = projectList.map(p => String(p.id));
    const boxContainer = document.getElementById('boxContainer');
    const frontFace = boxContainer.querySelector('.front');
    const backFace = boxContainer.querySelector('.back');
    const rightFace = boxContainer.querySelector('.right');
    const leftFace = boxContainer.querySelector('.left');
    const topFace = boxContainer.querySelector('.top');
    const bottomFace = boxContainer.querySelector('.bottom');

    let boxWidth = 200;
    let boxLength = 200;
    let boxHeight = 200;
    let rotateX = -30;
    let rotateY = 45;
    let positionX = 0;
    let positionY = 0;
    let positionZ = 0;
    let isoCardCount = 3;
    let isoCardSpacing = 50;
    let scrollPosition = 0;

    boxLength = Math.max(200, (isoCardCount * isoCardSpacing) + 100);

    const imagePaths = [
        'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=300&fit=crop',
        'https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=400&h=300&fit=crop',
        'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=400&h=300&fit=crop',
        'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=400&h=300&fit=crop',
        'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=400&h=300&fit=crop',
        'https://images.unsplash.com/photo-1505142468610-359e7d316be0?w=400&h=300&fit=crop',
        'https://images.unsplash.com/photo-1511497584788-876760111969?w=400&h=300&fit=crop',
        'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=400&h=300&fit=crop',
        'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&h=300&fit=crop'
    ];

    let lastMouseX = 0, lastMouseY = 0, mouseMoved = false, touchMoved = false;
    let previewedCard = null; // mobile: card that has been tapped once (preview); second tap opens

    function attachIsoCardHoverHandlers() {
        const frontDuplicates = boxContainer.querySelectorAll('.front-duplicate');
        frontDuplicates.forEach((isoCard) => {
            const newCard = isoCard.cloneNode(true);
            isoCard.parentNode.replaceChild(newCard, isoCard);
            newCard.addEventListener('mousedown', (e) => {
                lastMouseX = e.clientX;
                lastMouseY = e.clientY;
                mouseMoved = false;
            });
            newCard.addEventListener('mousemove', (e) => {
                if (Math.abs(e.clientX - lastMouseX) > 5 || Math.abs(e.clientY - lastMouseY) > 5) mouseMoved = true;
            });
            newCard.addEventListener('click', (e) => {
                if (!mouseMoved && !touchMoved) {
                    const projectId = newCard.getAttribute('data-project-id');
                    if (projectId) window.location.href = `project.html?id=${projectId}`;
                }
                mouseMoved = false;
                touchMoved = false;
            });
            newCard.addEventListener('touchstart', (e) => {
                if (e.touches.length === 1) {
                    lastMouseX = e.touches[0].clientX;
                    lastMouseY = e.touches[0].clientY;
                    touchMoved = false;
                }
            });
            newCard.addEventListener('touchmove', (e) => {
                if (e.touches.length === 1 && (Math.abs(e.touches[0].clientX - lastMouseX) > 5 || Math.abs(e.touches[0].clientY - lastMouseY) > 5)) touchMoved = true;
            });
            newCard.addEventListener('touchend', (e) => {
                if (!touchMoved && !scrollGestureUsed && e.changedTouches.length === 1) {
                    const projectId = newCard.getAttribute('data-project-id');
                    if (previewedCard === newCard) {
                        // Second tap: open project (card was already previewed)
                        if (projectId) { e.preventDefault(); window.location.href = `project.html?id=${projectId}`; }
                        previewedCard = null;
                    } else {
                        // First tap: card preview interaction (pop up like hover)
                        if (previewedCard) {
                            const prevOffset = parseFloat(previewedCard.dataset.baseOffset || '0');
                            previewedCard.style.transform = `translate(-50%, -50%) rotateY(0deg) translateZ(${prevOffset}px) translateY(0px)`;
                        }
                        const baseOffset = parseFloat(newCard.dataset.baseOffset || '0');
                        const popUpAmount = boxHeight * 0.3;
                        const centerTransform = 'translate(-50%, -50%)';
                        newCard.style.transform = `${centerTransform} rotateY(0deg) translateZ(${baseOffset}px) translateY(${-popUpAmount}px)`;
                        previewedCard = newCard;
                        e.preventDefault();
                    }
                }
                touchMoved = false;
            });
            newCard.addEventListener('mouseenter', () => {
                const baseOffset = parseFloat(newCard.dataset.baseOffset || '0');
                const popUpAmount = boxHeight * 0.3;
                const centerTransform = 'translate(-50%, -50%)';
                newCard.style.transform = `${centerTransform} rotateY(0deg) translateZ(${baseOffset}px) translateY(${-popUpAmount}px)`;
            });
            newCard.addEventListener('mouseleave', () => {
                const baseOffset = parseFloat(newCard.dataset.baseOffset || '0');
                newCard.style.transform = `translate(-50%, -50%) rotateY(0deg) translateZ(${baseOffset}px) translateY(0px)`;
            });
        });
    }

    function manageIsoCards() {
        const currentCards = boxContainer.querySelectorAll('.front-duplicate');
        const currentCount = currentCards.length;
        if (currentCount < isoCardCount) {
            for (let i = currentCount; i < isoCardCount; i++) {
                const newCard = document.createElement('div');
                newCard.className = 'box-face front-duplicate iso-card';
                newCard.setAttribute('data-duplicate', (i + 1).toString());
                newCard.setAttribute('data-project-id', projectIds.length ? projectIds[i % projectIds.length] : '');
                const img = document.createElement('img');
                const proj = projectList[i % projectList.length];
                img.src = (proj && proj.thumbnail) ? proj.thumbnail : imagePaths[i % imagePaths.length];
                img.alt = proj && proj.name ? proj.name : `Thumbnail ${(i % imagePaths.length) + 1}`;
                newCard.appendChild(img);
                boxContainer.insertBefore(newCard, backFace);
                newCard.addEventListener('wheel', handleWheelScroll, { passive: false });
                newCard.addEventListener('touchstart', handleTouchStart, { passive: true });
                newCard.addEventListener('touchmove', handleTouchMove, { passive: false });
                newCard.addEventListener('touchend', handleTouchEnd, { passive: true });
                newCard.addEventListener('touchcancel', handleTouchEnd, { passive: true });
            }
        } else if (currentCount > isoCardCount) {
            for (let i = currentCount - 1; i >= isoCardCount; i--) currentCards[i].remove();
        }
        const allCards = boxContainer.querySelectorAll('.front-duplicate');
        allCards.forEach((card, index) => {
            card.innerHTML = '';
            const img = document.createElement('img');
            const proj = projectList[index % projectList.length];
            img.src = (proj && proj.thumbnail) ? proj.thumbnail : imagePaths[index % imagePaths.length];
            img.alt = proj && proj.name ? proj.name : `Thumbnail ${(index % imagePaths.length) + 1}`;
            card.appendChild(img);
            card.setAttribute('data-project-id', projectIds.length ? projectIds[index % projectIds.length] : '');
        });
        attachIsoCardHoverHandlers();
        allCards.forEach(card => {
            card.addEventListener('wheel', handleWheelScroll, { passive: false });
            card.addEventListener('touchstart', handleTouchStart, { passive: true });
            card.addEventListener('touchmove', handleTouchMove, { passive: false });
            card.addEventListener('touchend', handleTouchEnd, { passive: true });
            card.addEventListener('touchcancel', handleTouchEnd, { passive: true });
        });
    }

    const centerTransform = 'translate(-50%, -50%)';

    function updateBox() {
        boxContainer.style.transform = `translate(-50%, -50%) translate3d(${positionX}px, ${positionY}px, ${positionZ}px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
        const halfWidth = boxWidth / 2, halfLength = boxLength / 2, halfHeight = boxHeight / 2;

        frontFace.style.width = boxWidth + 'px';
        frontFace.style.height = boxHeight + 'px';
        frontFace.style.left = '50%';
        frontFace.style.top = '50%';
        frontFace.style.transform = `${centerTransform} rotateY(0deg) translateZ(${halfLength}px)`;

        manageIsoCards();
        const frontDuplicates = boxContainer.querySelectorAll('.front-duplicate');
        frontDuplicates.forEach((duplicate, index) => {
            const virtualPosition = (index - scrollPosition) % isoCardCount;
            const wrappedPosition = virtualPosition < 0 ? virtualPosition + isoCardCount : virtualPosition;
            const offset = halfLength - ((wrappedPosition + 1) * isoCardSpacing);
            duplicate.dataset.baseOffset = offset;
            duplicate.style.width = boxWidth + 'px';
            duplicate.style.height = boxHeight + 'px';
            duplicate.style.left = '50%';
            duplicate.style.top = '50%';
            duplicate.style.transform = `${centerTransform} rotateY(0deg) translateZ(${offset}px)`;
        });

        backFace.style.width = boxWidth + 'px';
        backFace.style.height = boxHeight + 'px';
        backFace.style.left = '50%';
        backFace.style.top = '50%';
        backFace.style.transform = `${centerTransform} rotateY(180deg) translateZ(${halfLength}px)`;

        rightFace.style.width = boxLength + 'px';
        rightFace.style.height = boxHeight + 'px';
        rightFace.style.left = '50%';
        rightFace.style.top = '50%';
        rightFace.style.transform = `${centerTransform} rotateY(90deg) translateZ(${halfWidth}px)`;

        leftFace.style.width = boxLength + 'px';
        leftFace.style.height = boxHeight + 'px';
        leftFace.style.left = '50%';
        leftFace.style.top = '50%';
        leftFace.style.transform = `${centerTransform} rotateY(-90deg) translateZ(${halfWidth}px)`;

        topFace.style.width = boxWidth + 'px';
        topFace.style.height = boxLength + 'px';
        topFace.style.left = '50%';
        topFace.style.top = '50%';
        topFace.style.transform = `${centerTransform} rotateX(90deg) translateZ(${halfHeight}px)`;

        bottomFace.style.width = boxWidth + 'px';
        bottomFace.style.height = boxLength + 'px';
        bottomFace.style.left = '50%';
        bottomFace.style.top = '50%';
        bottomFace.style.transform = `${centerTransform} rotateX(-90deg) translateZ(${halfHeight}px)`;
    }

    function loadConfig(config) {
        if (config.width !== undefined) boxWidth = config.width;
        if (config.height !== undefined) boxHeight = config.height;
        if (config.isoCardCount !== undefined) isoCardCount = config.isoCardCount;
        if (config.isoCardSpacing !== undefined) isoCardSpacing = config.isoCardSpacing;
        if (config.rotateX !== undefined) rotateX = config.rotateX;
        if (config.rotateY !== undefined) rotateY = config.rotateY;
        if (config.positionX !== undefined) positionX = config.positionX;
        if (config.positionY !== undefined) positionY = config.positionY;
        if (config.positionZ !== undefined) positionZ = config.positionZ;
        boxLength = Math.max(200, (isoCardCount * isoCardSpacing) + 100);
        if (config.showFrontFace !== undefined) frontFace.style.display = config.showFrontFace ? 'flex' : 'none';
        if (config.showBackFace !== undefined) backFace.style.display = config.showBackFace ? 'flex' : 'none';
        if (config.showRightFace !== undefined) rightFace.style.display = config.showRightFace ? 'flex' : 'none';
        if (config.showLeftFace !== undefined) leftFace.style.display = config.showLeftFace ? 'flex' : 'none';
        if (config.showTopFace !== undefined) topFace.style.display = config.showTopFace ? 'flex' : 'none';
        if (config.showBottomFace !== undefined) bottomFace.style.display = config.showBottomFace ? 'flex' : 'none';
        updateBox();
    }

    let targetScrollPosition = 0;
    const scrollSensitivity = 0.01;

    function handleWheelScroll(e) {
        e.preventDefault();
        e.stopPropagation();
        targetScrollPosition -= e.deltaY * scrollSensitivity;
        requestAnimationFrame(() => {
            scrollPosition += (targetScrollPosition - scrollPosition) * 0.1;
            updateBox();
        });
    }

    let touchStartY = 0, touchStartX = 0, isTouching = false;
    let scrollGestureUsed = false; // so card tap doesn't navigate after a scroll
    const touchSensitivity = 0.02;

    function handleTouchStart(e) {
        if (e.touches.length === 1) {
            touchStartY = e.touches[0].clientY;
            touchStartX = e.touches[0].clientX;
            isTouching = true;
            // Tap outside cards: clear card preview (mobile)
            var t = e.target;
            if (!t || !t.closest || !t.closest('.front-duplicate')) {
                if (previewedCard) {
                    var prevOffset = parseFloat(previewedCard.dataset.baseOffset || '0');
                    previewedCard.style.transform = 'translate(-50%, -50%) rotateY(0deg) translateZ(' + prevOffset + 'px) translateY(0px)';
                    previewedCard = null;
                }
            }
        }
    }

    function handleTouchMove(e) {
        if (isTouching && e.touches.length === 1) {
            e.preventDefault();
            e.stopPropagation();
            const touchY = e.touches[0].clientY;
            const touchX = e.touches[0].clientX;
            const deltaY = touchStartY - touchY; // up = positive
            const deltaX = touchStartX - touchX;  // left-to-right = positive
            // Map both axes: left-to-right same as up-to-down, right-to-left same as down-to-up (inverted horizontal)
            const effectiveDelta = deltaY - deltaX;
            targetScrollPosition -= effectiveDelta * touchSensitivity;
            scrollGestureUsed = true;
            touchStartY = touchY;
            touchStartX = touchX;
        }
    }

    function handleTouchEnd() {
        isTouching = false;
        setTimeout(function () { scrollGestureUsed = false; }, 0);
    }

    const scene3d = document.querySelector('.scene-3d');
    const touchCapture = { passive: false };
    const touchStartOpt = { passive: true, capture: true };
    const touchMoveOpt = { passive: false, capture: true };
    const touchEndOpt = { passive: true, capture: true };
    window.addEventListener('wheel', handleWheelScroll, { passive: false });
    if (scene3d) scene3d.addEventListener('wheel', handleWheelScroll, { passive: false });
    boxContainer.addEventListener('wheel', handleWheelScroll, { passive: false });
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, touchCapture);
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    window.addEventListener('touchcancel', handleTouchEnd, { passive: true });
    if (scene3d) {
        scene3d.addEventListener('touchstart', handleTouchStart, touchStartOpt);
        scene3d.addEventListener('touchmove', handleTouchMove, touchMoveOpt);
        scene3d.addEventListener('touchend', handleTouchEnd, touchEndOpt);
        scene3d.addEventListener('touchcancel', handleTouchEnd, touchEndOpt);
    }
    boxContainer.addEventListener('touchstart', handleTouchStart, touchStartOpt);
    boxContainer.addEventListener('touchmove', handleTouchMove, touchMoveOpt);
    boxContainer.addEventListener('touchend', handleTouchEnd, touchEndOpt);
    boxContainer.addEventListener('touchcancel', handleTouchEnd, touchEndOpt);
    [frontFace, backFace, rightFace, leftFace, topFace, bottomFace].forEach(face => {
        if (face) {
            face.addEventListener('wheel', handleWheelScroll, { passive: false });
            face.addEventListener('touchstart', handleTouchStart, touchStartOpt);
            face.addEventListener('touchmove', handleTouchMove, touchMoveOpt);
            face.addEventListener('touchend', handleTouchEnd, touchEndOpt);
            face.addEventListener('touchcancel', handleTouchEnd, touchEndOpt);
        }
    });

    function animateScroll() {
        // Faster settle (0.25): smooth scroll finishes in less time; reduces frames of heavy DOM work
        if (Math.abs(targetScrollPosition - scrollPosition) > 0.015) {
            scrollPosition += (targetScrollPosition - scrollPosition) * 0.25;
            updateBox();
        }
        requestAnimationFrame(animateScroll);
    }
    animateScroll();

    updateBox();

    const PROJECT_FILES_CONFIG_KEY = 'project_files_3d_config';
    const defaultConfig = {
        width: 400,
        height: 300,
        isoCardCount: 60,
        isoCardSpacing: 84,
        rotateX: -30,
        rotateY: -45,
        positionX: -27,
        positionY: 48,
        positionZ: -216,
        showFrontFace: false,
        showBackFace: false,
        showRightFace: false,
        showLeftFace: false,
        showTopFace: false,
        showBottomFace: false
    };
    let config = defaultConfig;
    try {
        const raw = localStorage.getItem(PROJECT_FILES_CONFIG_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') config = parsed;
        }
    } catch (e) {}
    loadConfig(config);
});
