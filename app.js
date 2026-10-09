const content = document.querySelector('#content');
// Company marks are embedded, with monochrome fills supplied by CSS.
// Meta/Google: Simple Icons; LinkedIn: Simple Icons v11; DiDi: Wikimedia DiDi_Logo.svg.
// Fast: F from fast-af/devportal/images/fastDocsLogo.svg (the company’s developer portal).
const sections = {
  home: `<section class="home-links" aria-label="Explore Ming’s profile"><h1 class="sr-only">Ming Chang</h1><div class="browse-list"><a href="#about" class="browse-row"><span class="row-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/></svg></span><span class="row-copy"><strong>About me</strong><span>A little about me, and the path that brought me here.</span></span><svg class="row-chevron" viewBox="0 0 20 20" aria-hidden="true"><path d="m8 5 5 5-5 5"/></svg></a><a href="#work" class="browse-row"><span class="row-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V3h8v4M3 12h18M10 12v3h4v-3"/></svg></span><span class="row-copy"><strong>Work</strong><span>From payments and marketplaces to AI and experimentation.</span></span><svg class="row-chevron" viewBox="0 0 20 20" aria-hidden="true"><path d="m8 5 5 5-5 5"/></svg></a><a href="#travel" class="browse-row"><span class="row-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18Z"/></svg></span><span class="row-copy"><strong>Life</strong><span>Beijing, New York, the Bay Area. Swimming and switching off.</span></span><svg class="row-chevron" viewBox="0 0 20 20" aria-hidden="true"><path d="m8 5 5 5-5 5"/></svg></a><a href="#notes" class="browse-row"><span class="row-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h11l3 3v15H4V3h2ZM16 3v5h4M8 12h8M8 16h6"/></svg></span><span class="row-copy"><strong>Writing</strong><span>Real problems, clear writing, and making reasonable bets.</span></span><svg class="row-chevron" viewBox="0 0 20 20" aria-hidden="true"><path d="m8 5 5 5-5 5"/></svg></a></div></section>`,

  about: `<section class="detail"><h1>About me</h1><div class="prose"><p>I grew up in Beijing and spent four years studying math at Peking University, only to discover that I wasn't very good at it. After college, I moved to New York for a master's in Statistics at Columbia.</p><p>In 2013, I moved to the Bay Area and started my career at Google as a data scientist. I was lucky enough to work with some of the best—and nicest—product managers I've met. At some point, I started wondering: could I do what they do?</p><p>So I took a pivot (and detour), spending the next few years learning how to be a PM, mostly by making mistakes at DiDi, Fast, and LinkedIn. In January 2024, I joined Meta, where I've been having a lot of fun building products and learning new things.</p></div></section>`,
  work: `<div class="work-layout"><nav class="career-path" aria-label="Career path"><div class="career-steps"><span class="career-line" aria-hidden="true"></span><span class="career-indicator" aria-hidden="true"></span><button type="button" data-experience="meta" aria-current="step"><strong>Meta</strong><span>Jan 2024–present</span></button><button type="button" data-experience="linkedin"><strong>LinkedIn</strong><span>Dec 2021–Jan 2024</span></button><button type="button" data-experience="fast"><strong>Fast</strong><span>Mar–Dec 2021</span></button><button type="button" data-experience="didi"><strong>DiDi</strong><span>Jul 2018–Oct 2020</span></button><button type="button" data-experience="google"><strong>Google</strong><span>Sep 2013–Jul 2018</span></button></div></nav><article class="detail work-story"><h1>Work</h1><section class="experience" id="experience-meta" data-company="meta" aria-labelledby="company-meta"><header class="experience-heading"><h2 id="company-meta"><span class="company-logo" aria-hidden="true"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.915 4.03c-1.968 0-3.683 1.28-4.871 3.113C.704 9.208 0 11.883 0 14.449c0 .706.07 1.369.21 1.973a6.624 6.624 0 0 0 .265.86 5.297 5.297 0 0 0 .371.761c.696 1.159 1.818 1.927 3.593 1.927 1.497 0 2.633-.671 3.965-2.444.76-1.012 1.144-1.626 2.663-4.32l.756-1.339.186-.325c.061.1.121.196.183.3l2.152 3.595c.724 1.21 1.665 2.556 2.47 3.314 1.046.987 1.992 1.22 3.06 1.22 1.075 0 1.876-.355 2.455-.843a3.743 3.743 0 0 0 .81-.973c.542-.939.861-2.127.861-3.745 0-2.72-.681-5.357-2.084-7.45-1.282-1.912-2.957-2.93-4.716-2.93-1.047 0-2.088.467-3.053 1.308-.652.57-1.257 1.29-1.82 2.05-.69-.875-1.335-1.547-1.958-2.056-1.182-.966-2.315-1.303-3.454-1.303zm10.16 2.053c1.147 0 2.188.758 2.992 1.999 1.132 1.748 1.647 4.195 1.647 6.4 0 1.548-.368 2.9-1.839 2.9-.58 0-1.027-.23-1.664-1.004-.496-.601-1.343-1.878-2.832-4.358l-.617-1.028a44.908 44.908 0 0 0-1.255-1.98c.07-.109.141-.224.211-.327 1.12-1.667 2.118-2.602 3.358-2.602zm-10.201.553c1.265 0 2.058.791 2.675 1.446.307.327.737.871 1.234 1.579l-1.02 1.566c-.757 1.163-1.882 3.017-2.837 4.338-1.191 1.649-1.81 1.817-2.486 1.817-.524 0-1.038-.237-1.383-.794-.263-.426-.464-1.13-.464-2.046 0-2.221.63-4.535 1.66-6.088.454-.687.964-1.226 1.533-1.533a2.264 2.264 0 0 1 1.088-.285z"/></svg></span>Meta</h2><span>Jan 2024–present</span></header><p class="experience-role">Lead Product Manager</p><div class="experience-content meta-roles">
<details class="project-card"><summary><div class="project-summary"><h3>Experimentation Platform</h3><p>I build AI-native tools that help product teams plan experiments, evaluate results, and safely launch changes across Meta.</p></div><span class="project-toggle" aria-hidden="true"></span></summary><div class="project-details"><p class="card-role">Lead Product Manager</p><h4>Experiment Lab</h4><p>Built and launched a 0→1 AI-native platform where agents help teams plan and review what they build, addressing a new bottleneck as AI accelerated proposal creation beyond the capacity of expert reviewers.</p><p>Defined the strategy, formed a cross-organization team across platform and workflow owners, and brought an end-to-end workflow to a major Meta organization of 7,000 employees.</p><h4>Standard Launch Workflow</h4><p>Built a developer tool that orchestrates how features are shipped in code. Defined the product strategy, aligned teams across previously bespoke tools, and scaled the suite to Meta-wide adoption as the standard path for launching products.</p><h4>Building alongside engineering</h4><p>In 2026, I've made 400+ production code changes, prototyping, iterating, and shipping directly alongside engineering.</p><button class="inline-ask" data-question="Tell me about Ming's work on Meta's Experimentation Platform">Ask about this work <span><svg class="arrow-icon" viewBox="0 0 20 20" aria-hidden="true"><path d="M5 15 15 5M5 5h10v10"/></svg></span></button></div></details>
<details class="project-card"><summary><div class="project-summary"><h3>Facebook Notifications</h3><p>I worked on notification products and ML ranking systems that help people discover relevant content and stay connected, without spamming them.</p></div><span class="project-toggle" aria-hidden="true"></span></summary><div class="project-details"><p class="card-role">Product Manager</p><h4>Notification products & ranking</h4><p>Defined a two-year growth strategy for Facebook's social-graph notifications, expanding a shrinking surface into high-value semi-connected content. Introduced LLM-based content understanding into a ranking system previously driven primarily by relationship signals.</p><h4>A unified approach to attention</h4><p>Unified ranking across push notifications, notification center, and tab badges, which had independently competed for the same user attention. Drove alignment across two engineering organizations with conflicting incentives and ownership.</p><button class="inline-ask" data-question="Tell me about Ming's work on Facebook Notifications">Ask about this work <span><svg class="arrow-icon" viewBox="0 0 20 20" aria-hidden="true"><path d="M5 15 15 5M5 5h10v10"/></svg></span></button></div></details>
</div></section><section class="experience" id="experience-linkedin" data-company="linkedin" aria-labelledby="company-linkedin"><header class="experience-heading"><h2 id="company-linkedin"><span class="company-logo" aria-hidden="true"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg></span>LinkedIn</h2><span>Dec 2021–Jan 2024</span></header><p class="experience-role">Product Manager</p><div class="experience-content"><details class="project-card"><summary><h3>Services Marketplace</h3><span class="project-toggle" aria-hidden="true"></span></summary><div class="project-details"><p>Led product strategy and growth for a marketplace connecting buyers with professional service providers, from career coaches to designers and consultants. Grew transaction volume 1.7×.</p><button class="inline-ask" data-question="What did Ming build at LinkedIn?">Ask about this work <span><svg class="arrow-icon" viewBox="0 0 20 20" aria-hidden="true"><path d="M5 15 15 5M5 5h10v10"/></svg></span></button></div></details></div></section><section class="experience" id="experience-fast" data-company="fast" aria-labelledby="company-fast"><header class="experience-heading"><h2 id="company-fast"><span class="company-logo" aria-hidden="true"><svg viewBox="0 0 15 24" aria-hidden="true"><path d="M14.6635 4H4.60031V9.58678H13.3217V13.5868H4.60031V23.6033H0V1.91736C0 1.34435 0.19168 0.881543 0.575039 0.528927C0.958399 0.176309 1.4163 0 1.94874 0H14.6635V4Z"/></svg></span>Fast</h2><span>Mar–Dec 2021</span></header><p class="experience-role">Product Manager</p><div class="experience-content"><details class="project-card"><summary><h3>Payments platform</h3><span class="project-toggle" aria-hidden="true"></span></summary><div class="project-details"><p>Led product development for core payment-processing capabilities supporting the payments platform.</p><button class="inline-ask" data-question="What did Ming work on at Fast?">Ask about this work <span><svg class="arrow-icon" viewBox="0 0 20 20" aria-hidden="true"><path d="M5 15 15 5M5 5h10v10"/></svg></span></button></div></details></div></section><section class="experience" id="experience-didi" data-company="didi" aria-labelledby="company-didi"><header class="experience-heading"><h2 id="company-didi"><span class="company-logo" aria-hidden="true"><svg viewBox="0 5.1 36.4 29.41" aria-hidden="true"><path d="M29.25,11.7v5.01c0,6.17-5.05,11.16-11.24,11.05-6.06-.1-10.87-5.17-10.87-11.24v-3.96c0-.48.39-.87.87-.87h21.24v-6.59H1.7c-.94,0-1.7.76-1.7,1.7v9.29c0,10.03,8.03,18.35,18.06,18.42,10.11.07,18.33-8.1,18.33-18.2v-4.63h-7.14Z"/></svg></span>DiDi</h2><span>Jul 2018–Oct 2020</span></header><p class="experience-role">Data Scientist</p><div class="experience-content"><details class="project-card"><summary><h3>Payments & fintech</h3><span class="project-toggle" aria-hidden="true"></span></summary><div class="project-details"><p>Supported DiDi's Latin America expansion, optimizing payment conversion, local payment-method adoption, and new fintech initiatives including DiDi Pay.</p><button class="inline-ask" data-question="What did Ming do at DiDi?">Ask about this work <span><svg class="arrow-icon" viewBox="0 0 20 20" aria-hidden="true"><path d="M5 15 15 5M5 5h10v10"/></svg></span></button></div></details></div></section><section class="experience" id="experience-google" data-company="google" aria-labelledby="company-google"><header class="experience-heading"><h2 id="company-google"><span class="company-logo" aria-hidden="true"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"/></svg></span>Google</h2><span>Sep 2013–Jul 2018</span></header><p class="experience-role">Senior Product Analyst</p><div class="experience-content"><details class="project-card"><summary><h3>Google Play payments</h3><span class="project-toggle" aria-hidden="true"></span></summary><div class="project-details"><p>Supported Google Play's global payments business, using experimentation and large-scale behavioral data to improve checkout conversion and payment success across international markets.</p><button class="inline-ask" data-question="What did Ming work on at Google?">Ask about this work <span><svg class="arrow-icon" viewBox="0 0 20 20" aria-hidden="true"><path d="M5 15 15 5M5 5h10v10"/></svg></span></button></div></details></div></section></article></div>`,

  travel: `<section class="detail life-page"><h1>Life</h1><div class="life-categories">
    <details class="project-card life-category" id="life-places"><summary><h2>Places</h2><span class="project-toggle" aria-hidden="true"></span></summary><div class="life-category-body">
      <div class="places-toolbar"><button type="button" id="places-add" hidden>Add place</button><button type="button" id="places-edit">Edit places</button></div>
      <form id="places-login" class="places-login" hidden><label>Editing password<input id="places-password" type="password" autocomplete="current-password" maxlength="256" required aria-describedby="places-login-status"></label><p id="places-login-status" role="alert" hidden></p><div class="place-form-actions"><button type="submit">Unlock</button><button type="button" id="places-login-cancel">Cancel</button></div></form>
      <p id="places-status" role="status" hidden></p>
      <div class="places-layout">
        <aside class="places-rail"><figure class="place-globe"><svg id="life-globe" viewBox="0 0 280 280" role="img" aria-label="Globe showing Beijing"><circle cx="140" cy="140" r="119" class="globe-ocean"/><path class="globe-land"/><path class="globe-grid"/><circle cx="140" cy="140" r="119" class="globe-outline"/><g class="globe-pins"></g></svg><figcaption><strong id="globe-place">Beijing</strong><span id="globe-dates"></span></figcaption></figure><nav class="place-timeline" aria-label="Places timeline"><ol id="places-timeline"></ol></nav></aside>
        <div class="places-story"><ol class="place-entries" id="places-entries"></ol>
          <form id="place-editor" class="place-editor" hidden><h3 id="place-editor-title">Add place</h3><label>Location<div class="location-search"><input id="place-location" type="text" maxlength="100" autocomplete="off" required><button type="button" id="place-search">Find</button></div></label><div id="place-search-results" class="place-search-results"></div><div class="place-location-actions"><button type="button" id="place-pick">Pick on globe</button><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" id="place-attribution" hidden>© OpenStreetMap</a></div><div class="place-date-fields"><label>From<input type="month" id="place-from" min="1000-01" max="9999-12"></label><label>To<input type="month" id="place-to" min="1000-01" max="9999-12"></label></div><label class="place-present"><input type="checkbox" id="place-present">Present</label><label>Description<textarea id="place-note" rows="3" maxlength="1000"></textarea></label><fieldset class="place-highlight-editor"><legend>Highlights</legend><ul id="place-highlight-fields" class="place-highlight-fields"></ul><button type="button" id="place-highlight-add">Add highlight</button></fieldset><p id="place-form-status" role="status" hidden></p><div class="place-form-actions"><button type="submit">Save place</button><button type="button" id="place-cancel">Cancel</button></div></form>
        </div>
      </div>
    </div></details>
    <details class="project-card life-category"><summary><h2>Hobbies</h2><span class="project-toggle" aria-hidden="true"></span></summary><div class="life-category-body life-tbd"><p>TBD</p></div></details>
    <details class="project-card life-category"><summary><h2>Self-reflection</h2><span class="project-toggle" aria-hidden="true"></span></summary><div class="life-category-body life-tbd"><p>TBD</p></div></details>
  </div></section>`,
  notes: `<section class="detail"><div class="profile-kicker">HOW I THINK ABOUT MY CAREER</div><h1>Time well spent</h1><p class="section-intro">What I spend it on.<br>How I spend it.</p><p>As I get older, I care a little less about money and a lot more about the time I spend working. These are a few things that matter to me.</p><section class="detail-block"><span class="note-number">01</span><h2>Make a reasonable bet. Keep moving.</h2><p>Every product decision is a bet, and every bet comes with some risk. I'm comfortable with that. I'd rather make progress, learn something, and keep moving than spend weeks debating because nobody wants to make the call.</p></section><section class="detail-block"><span class="note-number">02</span><h2>Write to make things simple.</h2><p>When things get messy, I write a short essay explaining what matters, what doesn't, and why. The process of writing is how I figure things out myself. Thinking through what I want to say is part of the work.</p></section><section class="detail-block"><span class="note-number">03</span><h2>Stay close to people who care.</h2><p>People come for the work, but they stay for the people. Teammates who care push each other, hold each other accountable, and challenge ideas without questioning intentions.</p></section><section class="detail-block"><span class="note-number">04</span><h2>Real people, real problems.</h2><p>I'd rather work on a product with 10,000 users I can talk to every day than one with a billion users who exist only as generic personas and numbers on a dashboard.</p></section><button class="button" data-question="How does Ming approach product decisions?">Ask about my approach <span><svg class="arrow-icon" viewBox="0 0 20 20" aria-hidden="true"><path d="M5 15 15 5M5 5h10v10"/></svg></span></button></section>`
};
const labels = { home: 'Home', about: 'About me', work: 'Work', travel: 'Life', notes: 'Writing' };
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
  const sectionsBySource = { about: 'about', education: 'about', contact: 'about', work: 'work', career: 'work', meta: 'work', notifications: 'work', linkedin: 'work', google: 'work', didi: 'work', fast: 'work', travel: 'travel', interests: 'travel', philosophy: 'notes', complexity: 'notes', writing: 'notes', teams: 'notes', speed: 'notes' };
  const details = document.createElement('details'); details.className = 'sources';
  const summary = document.createElement('summary'); summary.textContent = `${sources.length} profile ${sources.length === 1 ? 'source' : 'sources'}`;
  const links = document.createElement('div'); links.className = 'source-links';
  for (const source of sources) {
    const button = document.createElement('button'); button.type = 'button'; button.textContent = source.title;
    button.addEventListener('click', () => { minimizeConversation(); location.hash = sectionsBySource[source.id] || 'about'; });
    links.append(button);
  }
  const date = document.createElement('div'); date.className = 'source-date'; date.textContent = 'From Ming’s public profile · October 2026';
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
  status.textContent = 'Reading Ming’s profile…';
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
