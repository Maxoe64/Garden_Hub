// === SeedGuide App ===

let seeds = [];
let currentSeed = null;
let myGarden = JSON.parse(localStorage.getItem('seedguide_garden') || '[]');
let chatHistory = [];
let chatConfig = { provider: 'ollama', model: 'llama3.2', web_search: true };

// === Initialize ===
document.addEventListener('DOMContentLoaded', () => {
    fetchSeeds();
    setupNavigation();
    renderGarden();
    loadChatConfig();
    // Set default start date to today
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('start-date').value = today;
});

// === Navigation ===
function setupNavigation() {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const section = link.dataset.section;
            showSection(section);
        });
    });
}

function showSection(sectionId) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    document.getElementById(sectionId).classList.add('active');
    const navLink = document.querySelector(`.nav-link[data-section="${sectionId}"]`);
    if (navLink) navLink.classList.add('active');
}

// === Seeds ===
async function fetchSeeds() {
    try {
        const resp = await fetch('/api/seeds');
        const data = await resp.json();
        seeds = data.seeds;
        renderSeeds(seeds);
    } catch (err) {
        console.error('Error fetching seeds:', err);
    }
}

function renderSeeds(seedList) {
    const grid = document.getElementById('seed-grid');
    grid.innerHTML = seedList.map(seed => `
        <div class="seed-card" onclick="showSeed('${seed.id}')">
            <div class="icon">${seed.icon}</div>
            <h3>${seed.name}</h3>
            <div class="meta">
                <span class="tag">${seed.category}</span>
                <span class="tag difficulty-${seed.difficulty}">${seed.difficulty}</span>
                <span class="tag">${seed.days_to_harvest} days</span>
            </div>
            <p>${seed.description}</p>
        </div>
    `).join('');

    // Setup filters
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const filter = btn.dataset.filter;
            if (filter === 'all') {
                renderSeeds(seeds);
            } else if (filter === 'beginner') {
                renderSeeds(seeds.filter(s => s.difficulty === 'beginner'));
            } else {
                renderSeeds(seeds.filter(s => s.category === filter));
            }
        });
    });
}

function showSeed(seedId) {
    currentSeed = seeds.find(s => s.id === seedId);
    if (!currentSeed) return;

    const info = document.getElementById('seed-info');
    info.innerHTML = `
        <div class="seed-detail-header">
            <div class="icon">${currentSeed.icon}</div>
            <div>
                <h2>${currentSeed.name}</h2>
                <p>${currentSeed.description}</p>
            </div>
        </div>
        <div class="detail-grid">
            <div class="detail-item">
                <div class="label">Sun</div>
                <div class="value">${currentSeed.sun}</div>
            </div>
            <div class="detail-item">
                <div class="label">Water</div>
                <div class="value">${currentSeed.water}</div>
            </div>
            <div class="detail-item">
                <div class="label">Soil</div>
                <div class="value">${currentSeed.soil}</div>
            </div>
            <div class="detail-item">
                <div class="label">Germination</div>
                <div class="value">${currentSeed.days_to_germination} days</div>
            </div>
            <div class="detail-item">
                <div class="label">Days to Harvest</div>
                <div class="value">${currentSeed.days_to_harvest} days</div>
            </div>
            <div class="detail-item">
                <div class="label">Frost Tolerant</div>
                <div class="value">${currentSeed.temperature.frost_tolerant ? 'Yes' : 'No'}</div>
            </div>
            <div class="detail-item">
                <div class="label">Spacing</div>
                <div class="value">${currentSeed.spacing.between_plants}</div>
            </div>
            <div class="detail-item">
                <div class="label">Container Size</div>
                <div class="value">${currentSeed.spacing.container_size}</div>
            </div>
        </div>
        <button class="btn-secondary" onclick="addToGarden('${currentSeed.id}')">
            ${myGarden.find(g => g.id === currentSeed.id) ? '✓ In My Garden' : '+ Add to My Garden'}
        </button>
    `;

    document.getElementById('guide-result').classList.add('hidden');
    showSection('seed-detail');
}

// === Guide Generation ===
async function generateGuide() {
    if (!currentSeed) return;

    const space = document.getElementById('space-select').value;
    const experience = document.getElementById('experience-select').value;
    const startDate = document.getElementById('start-date').value;

    try {
        const resp = await fetch('/api/guide', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                seed_id: currentSeed.id,
                space,
                experience,
                start_date: startDate
            })
        });

        const guide = await resp.json();
        renderGuide(guide);
    } catch (err) {
        console.error('Error generating guide:', err);
    }
}

function renderGuide(guide) {
    const result = document.getElementById('guide-result');

    let html = `
        <div class="guide-section">
            <h3>Personalized Recommendations</h3>
            <ul>${guide.recommendations.map(r => `<li>${r}</li>`).join('')}</ul>
        </div>

        <div class="guide-section">
            <h3>Equipment Needed</h3>
            <ul>${guide.equipment.map(e => `<li>${e}</li>`).join('')}</ul>
        </div>

        <div class="guide-section">
            <h3>Growing Timeline</h3>
            <div class="timeline">
                ${guide.steps.map(s => `
                    <div class="timeline-item">
                        <div class="week">Week ${s.week}</div>
                        <div class="step">${s.step}</div>
                    </div>
                `).join('')}
            </div>
        </div>

        <div class="guide-section">
            <h3>Pro Tips</h3>
            <ul>${guide.tips.map(t => `<li>${t}</li>`).join('')}</ul>
        </div>

        <div class="guide-section">
            <h3>Library & Community Resources</h3>
            <ul>${guide.library_resources.map(r => `<li>${r}</li>`).join('')}</ul>
        </div>

        <button class="calendar-btn" onclick="downloadCalendar()">Download Calendar Reminders (.ics)</button>
    `;

    result.innerHTML = html;
    result.classList.remove('hidden');
}

// === Calendar Export ===
function downloadCalendar() {
    if (!currentSeed) return;

    const startDate = document.getElementById('start-date').value;
    if (!startDate) {
        alert('Please select a start date first.');
        return;
    }

    const start = new Date(startDate);
    let ics = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//SeedGuide//Growing Calendar//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
`;

    currentSeed.growing_steps.forEach(step => {
        const eventDate = new Date(start);
        eventDate.setDate(eventDate.getDate() + (step.week * 7));
        const dateStr = eventDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
        const endDate = new Date(eventDate);
        endDate.setHours(endDate.getHours() + 1);
        const endStr = endDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

        ics += `BEGIN:VEVENT
DTSTART:${dateStr}
DTEND:${endStr}
SUMMARY:${currentSeed.name} - Week ${step.week}
DESCRIPTION:${step.step.replace(/,/g, '\\,')}
BEGIN:VALARM
TRIGGER:-PT30M
ACTION:DISPLAY
DESCRIPTION:Time to check on your ${currentSeed.name}!
END:VALARM
END:VEVENT
`;
    });

    ics += 'END:VCALENDAR';

    const blob = new Blob([ics], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `seedguide-${currentSeed.id}-calendar.ics`;
    a.click();
    URL.revokeObjectURL(url);
}

// === My Garden ===
function addToGarden(seedId) {
    if (myGarden.find(g => g.id === seedId)) return;

    const seed = seeds.find(s => s.id === seedId);
    if (!seed) return;

    myGarden.push({
        id: seed.id,
        name: seed.name,
        icon: seed.icon,
        addedDate: new Date().toISOString(),
        steps: seed.growing_steps,
        currentStep: 0,
        daysToHarvest: parseInt(seed.days_to_harvest)
    });

    localStorage.setItem('seedguide_garden', JSON.stringify(myGarden));
    renderGarden();
    // Refresh the button text
    showSeed(seedId);
}

function removeFromGarden(seedId) {
    myGarden = myGarden.filter(g => g.id !== seedId);
    localStorage.setItem('seedguide_garden', JSON.stringify(myGarden));
    renderGarden();
}

function renderGarden() {
    const empty = document.getElementById('garden-empty');
    const grid = document.getElementById('garden-plants');

    if (myGarden.length === 0) {
        empty.style.display = 'block';
        grid.innerHTML = '';
        return;
    }

    empty.style.display = 'none';

    grid.innerHTML = myGarden.map(plant => {
        const added = new Date(plant.addedDate);
        const now = new Date();
        const daysSincePlant = Math.floor((now - added) / (1000 * 60 * 60 * 24));
        const progress = Math.min(100, Math.round((daysSincePlant / plant.daysToHarvest) * 100));

        // Find current step
        const currentWeek = Math.floor(daysSincePlant / 7);
        let currentStepIdx = 0;
        for (let i = 0; i < plant.steps.length; i++) {
            if (plant.steps[i].week <= currentWeek) currentStepIdx = i;
        }
        const nextStep = plant.steps[Math.min(currentStepIdx + 1, plant.steps.length - 1)];

        return `
            <div class="garden-card">
                <div class="header">
                    <span class="name">${plant.icon} ${plant.name}</span>
                    <button class="remove-btn" onclick="removeFromGarden('${plant.id}')" title="Remove">✕</button>
                </div>
                <div class="status">Planted ${daysSincePlant} days ago | ${progress}% to harvest</div>
                <div class="progress-bar"><div class="fill" style="width: ${progress}%"></div></div>
                <div class="next-step"><strong>Next step:</strong> ${nextStep.step}</div>
            </div>
        `;
    }).join('');
}

// === Chat Widget ===
function toggleChat() {
    const panel = document.getElementById('chat-panel');
    const icon = document.querySelector('.chat-icon');
    const closeIcon = document.querySelector('.chat-close-icon');

    panel.classList.toggle('hidden');
    icon.classList.toggle('hidden');
    closeIcon.classList.toggle('hidden');
}

function toggleSettings() {
    const settings = document.getElementById('chat-settings');
    settings.classList.toggle('hidden');
}

async function loadChatConfig() {
    try {
        const resp = await fetch('/api/config');
        const config = await resp.json();
        chatConfig.provider = config.provider;
        chatConfig.web_search = config.web_search;

        const providerSelect = document.getElementById('provider-select');
        providerSelect.value = config.provider;

        const modelSelect = document.getElementById('model-select');
        const statusEl = document.getElementById('settings-status');

        if (config.ollama.available && config.ollama.models.length > 0) {
            modelSelect.innerHTML = config.ollama.models.map(m =>
                `<option value="${m}" ${m === config.ollama.model ? 'selected' : ''}>${m}</option>`
            ).join('');
            chatConfig.model = config.ollama.model;
            statusEl.textContent = `Ollama connected (${config.ollama.models.length} models)`;
        } else if (config.provider === 'ollama') {
            statusEl.textContent = 'Ollama not connected. Install from ollama.ai and run: ollama pull llama3.2';
        }

        if (config.provider === 'anthropic') {
            statusEl.textContent = config.anthropic.available ? 'Claude API connected' : 'API key not set';
            modelSelect.innerHTML = `<option value="${config.anthropic.model}">${config.anthropic.model}</option>`;
        }

        document.getElementById('web-search-toggle').checked = config.web_search;
    } catch (err) {
        console.error('Error loading config:', err);
    }
}

function onProviderChange() {
    const provider = document.getElementById('provider-select').value;
    chatConfig.provider = provider;
    loadChatConfig();
}

async function sendMessage() {
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    if (!message) return;

    input.value = '';

    // Add user message
    addChatMessage('user', message);
    chatHistory.push({ role: 'user', content: message });

    // Show typing indicator
    const messagesDiv = document.getElementById('chat-messages');
    const typingDiv = document.createElement('div');
    typingDiv.className = 'chat-message assistant typing';
    typingDiv.innerHTML = '<div class="typing-indicator"><span></span><span></span><span></span></div>';
    messagesDiv.appendChild(typingDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;

    try {
        const useWebSearch = document.getElementById('web-search-toggle').checked;
        const resp = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message,
                history: chatHistory.slice(-6),
                provider: chatConfig.provider,
                model: document.getElementById('model-select').value,
                use_web_search: useWebSearch
            })
        });

        const data = await resp.json();

        // Remove typing indicator
        typingDiv.remove();

        // Add response with web sources
        let responseHtml = data.response;
        if (data.web_sources && data.web_sources.length > 0) {
            responseHtml += '\n\n---\nSources:';
            addChatMessage('assistant', responseHtml, data.web_sources);
        } else {
            addChatMessage('assistant', data.response);
        }

        chatHistory.push({ role: 'assistant', content: data.response });
    } catch (err) {
        typingDiv.remove();
        addChatMessage('assistant', 'Sorry, I encountered an error. Make sure your AI provider (Ollama or Anthropic) is running.');
    }
}

function addChatMessage(role, text, webSources) {
    const messagesDiv = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.className = `chat-message ${role}`;

    // Basic markdown: bold, italic, line breaks
    let html = text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/\n/g, '<br>');

    div.innerHTML = `<p>${html}</p>`;

    if (webSources && webSources.length > 0) {
        const sourcesDiv = document.createElement('div');
        sourcesDiv.className = 'web-sources';
        sourcesDiv.innerHTML = webSources.map(s =>
            `<a href="${s.url}" target="_blank" rel="noopener">🔗 ${s.title}</a>`
        ).join('');
        div.appendChild(sourcesDiv);
    }

    messagesDiv.appendChild(div);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}
