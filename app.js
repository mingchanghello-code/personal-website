const content = document.querySelector('#content');
const labels = { home: 'Home', about: 'About me', work: 'Work', travel: 'Travel', hobbies: 'Hobbies', notes: 'Writing' };
const panel = document.querySelector('#chat-panel');
const questionInput = document.querySelector('#question');
const messages = document.querySelector('#messages');
const form = document.querySelector('#chat-form');
const status = document.querySelector('#chat-status');
const submitButton = form.querySelector('button[type="submit"]');
const resetButton = document.querySelector('#chat-reset');
const resumeButton = document.querySelector('#chat-resume');
const backdrop = document.querySelector('#chat-backdrop');
const mobile = window.matchMedia('(max-width: 950px)');
let busy = false;
let history = [];
let previousFocus = null;

const selectionAsk = document.querySelector('#selection-ask');
let selectedWorkText = '';
let selectionFrame = null;
function hideSelectionAsk() {
  selectionAsk.hidden = true;
  selectedWorkText = '';
}
function updateSelectionAsk() {
  const selection = window.getSelection();
  const story = content.querySelector('.work-story');
  // Keep the action available when a keyboard user tabs from their selection.
  if (document.activeElement === selectionAsk && selectedWorkText && story) return;
  if (!story || story.closest('[inert]') || !selection?.rangeCount || selection.isCollapsed) {
    hideSelectionAsk(); return;
  }
  const range = selection.getRangeAt(0);
  const start = range.startContainer.nodeType === Node.ELEMENT_NODE ? range.startContainer : range.startContainer.parentElement;
  const end = range.endContainer.nodeType === Node.ELEMENT_NODE ? range.endContainer : range.endContainer.parentElement;
  const text = selection.toString().replace(/\s+/g, ' ').trim();
  if (!text || !story.contains(start) || !story.contains(end) ||
      start.closest('button, a, input, textarea, .sr-only') || end.closest('button, a, input, textarea, .sr-only')) {
    hideSelectionAsk(); return;
  }
  const viewportWidth = document.documentElement.clientWidth;
  const viewportHeight = window.innerHeight;
  const chat = panel.getBoundingClientRect();
  const career = content.querySelector('.career-path').getBoundingClientRect();
  const visibleRects = [...range.getClientRects()].filter(rect => {
    const behindChat = rect.right > chat.left && rect.left < chat.right && rect.bottom > chat.top;
    const behindCareer = rect.right > career.left && rect.left < career.right && rect.top < career.bottom && rect.bottom > career.top;
    return rect.width > 0 && rect.height > 0 && rect.top >= 0 && rect.bottom <= viewportHeight && !behindChat && !behindCareer;
  });
  if (!visibleRects.length) { hideSelectionAsk(); return; }
  const forward = selection.anchorNode === range.startContainer && selection.anchorOffset === range.startOffset;
  const anchor = forward ? visibleRects.at(-1) : visibleRects[0];
  selectedWorkText = text;
  selectionAsk.hidden = false;
  const { width, height } = selectionAsk.getBoundingClientRect();
  const left = Math.max(8, Math.min(anchor.left + anchor.width / 2 - width / 2, viewportWidth - width - 8));
  const bottomLimit = left + width > chat.left && left < chat.right ? chat.top - 8 : viewportHeight - 8;
  const top = anchor.top >= height + 8 ? anchor.top - height - 8 : anchor.bottom + 8;
  selectionAsk.style.left = `${left}px`;
  selectionAsk.style.top = `${Math.max(8, Math.min(top, bottomLimit - height))}px`;
}
function scheduleSelectionAsk() {
  if (selectionFrame !== null) return;
  selectionFrame = requestAnimationFrame(() => { selectionFrame = null; updateSelectionAsk(); });
}
document.addEventListener('selectionchange', scheduleSelectionAsk);
document.addEventListener('pointerup', scheduleSelectionAsk);
document.addEventListener('pointerdown', e => {
  if (selectionAsk.contains(e.target)) {
    // Clicking the action must not collapse the selection before it is captured.
    e.preventDefault();
  } else hideSelectionAsk();
});
document.addEventListener('focusin', e => {
  if (e.target !== selectionAsk && !content.contains(e.target)) hideSelectionAsk();
});
window.addEventListener('scroll', scheduleSelectionAsk, { passive: true });
window.addEventListener('resize', scheduleSelectionAsk, { passive: true });
selectionAsk.addEventListener('click', () => {
  if (!selectedWorkText) return;
  const prefix = 'Tell me more about ';
  const limit = questionInput.maxLength - prefix.length;
  const excerpt = selectedWorkText.length > limit ? `${selectedWorkText.slice(0, limit - 1).trimEnd()}…` : selectedWorkText;
  questionInput.value = prefix + excerpt;
  hideSelectionAsk();
  window.getSelection()?.removeAllRanges();
  resizeInput();
  focusComposer();
  questionInput.setSelectionRange(questionInput.value.length, questionInput.value.length);
});

let careerFrame = null;
function scheduleCareerSync() {
  if (careerFrame !== null) return;
  careerFrame = requestAnimationFrame(() => { careerFrame = null; syncCareerStep(); });
}
function syncCareerStep() {
  const experiences = [...content.querySelectorAll('.experience[data-company]')];
  if (!experiences.length) return;
  const stickyPath = content.querySelector('.career-path');
  const compact = window.matchMedia('(max-width: 1050px)').matches;
  const scrollMargin = parseFloat(getComputedStyle(experiences[0]).scrollMarginTop) || 0;
  const activationLine = compact ? Math.max(stickyPath.getBoundingClientRect().height + 45, scrollMargin + 2) : Math.min(200, window.innerHeight * .24);
  let current = experiences[0];
  for (const experience of experiences) if (experience.getBoundingClientRect().top <= activationLine) current = experience;
  const steps = [...content.querySelectorAll('[data-experience]')];
  for (const step of steps) {
    const active = step.dataset.experience === current.dataset.company;
    if (active) {
      step.setAttribute('aria-current', 'step');
      step.parentElement.style.setProperty('--step-offset', `${step.offsetTop + 22}px`);
    } else step.removeAttribute('aria-current');
  }
}
window.addEventListener('scroll', scheduleCareerSync, { passive: true });
window.addEventListener('resize', scheduleCareerSync, { passive: true });
content.addEventListener('toggle', e => {
  if (!e.target.matches('.project-card')) return;
  scheduleCareerSync();
  scheduleSelectionAsk();
}, true);
content.addEventListener('click', e => {
  const step = e.target.closest('[data-experience]');
  if (!step) return;
  const target = document.getElementById(`experience-${step.dataset.experience}`);
  target?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
});
let lifeController = null;
function render() {
  lifeController?.dispose();
  lifeController = null;
  hideSelectionAsk();
  const section = location.hash.slice(1) || 'home';
  const current = sections[section] ? section : 'home';
  content.innerHTML = sections[current];
  content.classList.toggle('work-page', current === 'work');
  content.classList.toggle('life-content', current === 'travel');
  if (current === 'travel') lifeController = mountLife(content);
  scheduleCareerSync();
  document.querySelectorAll('nav a').forEach(a => {
    a.classList.toggle('active', a.dataset.section === current);
    if (a.dataset.section === current) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  document.title = `${labels[current]} — Ming Chang`;
}
function syncModal() {
  const isModal = panel.classList.contains('open') && mobile.matches;
  backdrop.classList.toggle('visible', isModal);
  document.body.classList.toggle('chat-open', isModal);
  // The composer lives inside main, so only the surrounding content becomes inert.
  for (const element of document.querySelectorAll('.sidebar, .content, main>footer')) element.inert = isModal;
  if (isModal) { panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true'); }
  else { panel.removeAttribute('role'); panel.removeAttribute('aria-modal'); }
  resumeButton.hidden = !messages.children.length || panel.classList.contains('open');
}
function openConversation() {
  if (messages.children.length) panel.classList.add('open');
  syncModal();
}
function minimizeConversation() {
  panel.classList.remove('open'); syncModal();
  if (previousFocus?.isConnected && previousFocus !== questionInput) previousFocus.focus({ preventScroll: true });
}
function focusComposer() {
  previousFocus = document.activeElement;
  openConversation(); questionInput.focus({ preventScroll: true });
}
function scrollMessages() { messages.scrollTop = messages.scrollHeight; }
function addMessage(text, type) {
  const el = document.createElement('div'); el.className = `message ${type}`;
  const label = document.createElement('div'); label.className = 'message-label'; label.textContent = type === 'user' ? 'You' : 'Profile assistant';
  const body = document.createElement('div'); body.className = 'message-body'; body.textContent = text;
  el.append(label, body); messages.append(el); scrollMessages(); return el;
}
function addSources(element, sources) {
  if (!sources.length) return;
  const sectionsBySource = { about: 'about', education: 'about', contact: 'about', work: 'work', career: 'work', meta: 'work', notifications: 'work', linkedin: 'work', google: 'work', didi: 'work', fast: 'work', travel: 'travel', interests: 'hobbies', philosophy: 'notes', complexity: 'notes', writing: 'notes', teams: 'notes', speed: 'notes' };
  const details = document.createElement('details'); details.className = 'sources';
  const summary = document.createElement('summary'); summary.textContent = `${sources.length} profile ${sources.length === 1 ? 'source' : 'sources'}`;
  const links = document.createElement('div'); links.className = 'source-links';
  for (const source of sources) {
    const button = document.createElement('button'); button.type = 'button'; button.textContent = source.title;
    button.addEventListener('click', () => {
      minimizeConversation();
      location.hash = source.section || sectionsBySource[source.id] || 'about';
    });
    links.append(button);
  }
  const date = document.createElement('div'); date.className = 'source-date'; date.textContent = 'From Ming’s published website and profile';
  details.append(summary, links, date); element.append(details);
}
function resizeInput() {
  questionInput.style.height = 'auto'; questionInput.style.height = Math.min(questionInput.scrollHeight, 140) + 'px';
  submitButton.disabled = busy || !questionInput.value.trim();
}
function setBusy(value) {
  busy = value; resetButton.disabled = value; submitButton.disabled = value || !questionInput.value.trim();
  form.setAttribute('aria-busy', String(value));
  document.querySelectorAll('[data-question]').forEach(b => b.disabled = value);
}
async function ask(question, retry = false) {
  const text = question.trim(); if (!text || busy) return;
  if (text.length > 1000) { status.textContent = 'Please keep your question under 1,000 characters.'; return; }
  previousFocus = document.activeElement;
  if (!retry) addMessage(text, 'user');
  document.querySelectorAll('.message.error').forEach(el => el.remove());
  openConversation();
  if (mobile.matches) questionInput.focus({ preventScroll: true });
  if (location.protocol === 'file:') {
    addMessage('This is a local preview. The profile assistant is available when the website is running through its server.', 'assistant');
    status.textContent = 'Preview mode'; return;
  }
  questionInput.value = ''; resizeInput(); setBusy(true);
  status.textContent = 'Reading Ming’s website knowledge…';
  const pending = addMessage('', 'assistant'); pending.classList.add('pending'); pending.setAttribute('aria-label', 'The assistant is preparing an answer');
  const dots = document.createElement('div'); dots.className = 'typing-dots'; dots.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < 3; i++) dots.append(document.createElement('span'));
  pending.querySelector('.message-body').append(dots); scrollMessages();
  try {
    const response = await fetch('/api/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(22000),
      body: JSON.stringify({ question: text, history: history.slice(-6).map(m => ({ ...m, content: m.content.slice(0, 2000) })) })
    });
    if (!response.ok) throw new Error(response.status === 429 ? 'rate-limit' : 'unavailable');
    const result = await response.json();
    pending.remove(); const message = addMessage(result.answer, 'assistant'); addSources(message, result.sources);
    history.push({ role: 'user', content: text }, { role: 'assistant', content: result.answer });
    status.textContent = result.mode === 'ai' ? 'Answered from profile · AI-assisted' : 'Answered from profile';
    scrollMessages();
  } catch (error) {
    pending.remove();
    const message = addMessage(error.message === 'rate-limit' ? 'A few too many questions at once. Please wait a moment, then try again.' : 'I couldn’t load an answer just now. Please try again, or keep exploring the profile.', 'assistant');
    message.classList.add('error'); const retryButton = document.createElement('button'); retryButton.type = 'button'; retryButton.className = 'retry-button'; retryButton.textContent = 'Try again';
    retryButton.addEventListener('click', () => ask(text, true)); message.append(retryButton);
    status.textContent = 'Answer unavailable'; scrollMessages();
  } finally { setBusy(false); }
}
form.addEventListener('submit', e => { e.preventDefault(); ask(questionInput.value); });
questionInput.addEventListener('input', resizeInput);
questionInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); if (!submitButton.disabled) form.requestSubmit(); }
});
document.addEventListener('click', e => { const button = e.target.closest('[data-question]'); if (button) ask(button.dataset.question); });
resumeButton.addEventListener('click', focusComposer);
document.querySelector('#chat-close').addEventListener('click', minimizeConversation);
backdrop.addEventListener('click', minimizeConversation);
resetButton.addEventListener('click', () => {
  if (busy) return; history = []; messages.replaceChildren(); status.textContent = 'Answers from my public profile'; minimizeConversation(); questionInput.focus({ preventScroll: true });
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !selectionAsk.hidden) {
    const actionFocused = document.activeElement === selectionAsk;
    hideSelectionAsk();
    window.getSelection()?.removeAllRanges();
    if (actionFocused) content.focus({ preventScroll: true });
    return;
  }
  if (e.key === 'Escape' && panel.classList.contains('open')) minimizeConversation();
  if (e.key === 'Tab' && mobile.matches && panel.classList.contains('open')) {
    const targets = [...panel.querySelectorAll('button:not(:disabled), textarea, summary')].filter(el => el.getClientRects().length);
    const first = targets[0], last = targets.at(-1);
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
  }
});
mobile.addEventListener('change', syncModal);
window.addEventListener('hashchange', () => {
  if (location.hash === '#content') { content.focus({ preventScroll: true }); return; }
  render(); window.scrollTo({ top: 0, behavior: 'instant' }); if (!(mobile.matches && panel.classList.contains('open'))) content.focus({ preventScroll: true });
});
document.querySelector('#year').textContent = new Date().getFullYear();
render(); resizeInput();
