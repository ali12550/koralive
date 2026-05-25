// ============ Configuration ============
const FREE_APIS = {
    FOOTBALL_DATA: 'https://api.football-data.org/v4',
    THESPORTSDB: 'https://www.thesportsdb.com/api/v1/json/3',
};

// football-data.org requires a free API key — register at football-data.org
// Paste your free key below (takes ~1 minute to get)
const API_KEY = ''; // <-- paste your free key here
const API_BASE = FREE_APIS.FOOTBALL_DATA;

// ============ State Management ============
let currentLanguage = 'ar';
let favorites = JSON.parse(localStorage.getItem('favorites')) || [];
let selectedDate = new Date().toISOString().split('T')[0];
let allMatchesCache = [];

// ============ Language Translations ============
const translations = {
    ar: {
        matches: 'المباريات',
        standings: 'الترتيب',
        favorites: 'المفضلة',
        loading: 'جاري التحميل...',
        yesterday: 'أمس',
        tomorrow: 'غدا',
        allLeagues: 'جميع الدوريات',
        notStarted: 'لم تبدأ بعد',
        live: 'مباشر',
        finished: 'انتهت',
        channel: 'القناة',
        commentator: 'المعلق',
        goals: 'الأهداف',
        cards: 'البطاقات',
        noMatches: 'لا توجد مباريات متاحة',
        noFavorites: 'لم تضف أي مباريات للمفضلة بعد',
        apiKeyMissing: '⚠️ أضف مفتاح API في ملف app.js للحصول على بيانات حقيقية',
        error: 'خطأ في تحميل البيانات',
    },
    en: {
        matches: 'Matches',
        standings: 'Standings',
        favorites: 'Favorites',
        loading: 'Loading...',
        yesterday: 'Yesterday',
        tomorrow: 'Tomorrow',
        allLeagues: 'All Leagues',
        notStarted: 'Not Started',
        live: 'LIVE',
        finished: 'Finished',
        channel: 'Channel',
        commentator: 'Commentator',
        goals: 'Goals',
        cards: 'Cards',
        noMatches: 'No matches available',
        noFavorites: 'No favorite matches added yet',
        apiKeyMissing: '⚠️ Add your free API key in app.js to load real match data',
        error: 'Error loading data',
    }
};

// ============ API Functions ============
async function fetchMatches(date) {
    try {
        showLoading(true);

        if (!API_KEY) {
            // No key — try TheSportsDB fallback immediately
            return await fetchMatchesAlternate(date);
        }

        const response = await fetch(
            `${API_BASE}/matches?dateFrom=${date}&dateTo=${date}`,
            {
                headers: { 'X-Auth-Token': API_KEY }
            }
        );

        if (!response.ok) {
            console.warn('football-data.org failed:', response.status);
            return await fetchMatchesAlternate(date);
        }

        const data = await response.json();
        const matches = data.matches || [];

        if (matches.length > 0) cacheMatchData(date, matches);
        return matches;

    } catch (error) {
        console.error('Error fetching matches:', error);
        return await fetchMatchesAlternate(date);
    } finally {
        showLoading(false);
    }
}

// Fallback: TheSportsDB (no auth needed, free forever)
async function fetchMatchesAlternate(date) {
    try {
        // TheSportsDB: fetch events by date for major leagues
        const response = await fetch(
            `${FREE_APIS.THESPORTSDB}/eventsday.php?d=${date}&s=Soccer`
        );

        if (!response.ok) throw new Error('TheSportsDB failed');

        const data = await response.json();
        const events = data.events || [];

        // Normalise TheSportsDB schema → internal schema
        return events.map(e => ({
            id: e.idEvent,
            competition: { name: e.strLeague, code: e.idLeague },
            homeTeam: { name: e.strHomeTeam, crest: e.strHomeTeamBadge || null },
            awayTeam: { name: e.strAwayTeam, crest: e.strAwayTeamBadge || null },
            status: e.strStatus === 'Match Finished' ? 'FINISHED'
                  : e.strStatus === 'In Progress'   ? 'IN_PLAY'
                  : 'SCHEDULED',
            utcDate: e.dateEvent + 'T' + (e.strTime || '00:00:00') + 'Z',
            score: {
                fullTime: {
                    home: e.intHomeScore !== null ? parseInt(e.intHomeScore) : null,
                    away: e.intAwayScore !== null ? parseInt(e.intAwayScore) : null,
                }
            }
        }));

    } catch (error) {
        console.error('TheSportsDB also failed:', error);
        showNotification(getTranslation('apiKeyMissing'));
        return getLocalCacheData(date);
    }
}

async function fetchStandings(leagueId) {
    try {
        showLoading(true);

        if (!API_KEY) {
            showNotification(getTranslation('apiKeyMissing'));
            return [];
        }

        const response = await fetch(
            `${API_BASE}/competitions/${leagueId}/standings`,
            { headers: { 'X-Auth-Token': API_KEY } }
        );

        if (!response.ok) throw new Error('Standings fetch failed: ' + response.status);
        const data = await response.json();
        return data.standings?.[0]?.table || [];

    } catch (error) {
        console.error('Error fetching standings:', error);
        showNotification(getTranslation('error'));
        return [];
    } finally {
        showLoading(false);
    }
}

async function fetchMatchDetails(matchId) {
    try {
        if (!API_KEY) return null;

        const response = await fetch(
            `${API_BASE}/matches/${matchId}`,
            { headers: { 'X-Auth-Token': API_KEY } }
        );

        if (!response.ok) throw new Error('Match details failed');
        const data = await response.json();
        // football-data.org wraps in { match: ... } OR returns root object
        return data.match || data || null;

    } catch (error) {
        console.error('Error fetching match details:', error);
        return null;
    }
}

// ============ Local Cache ============
function getLocalCacheData(date) {
    try {
        const cached = localStorage.getItem(`matches_${date}`);
        return cached ? JSON.parse(cached) : [];
    } catch { return []; }
}

function cacheMatchData(date, data) {
    try {
        localStorage.setItem(`matches_${date}`, JSON.stringify(data));
    } catch {}
}

// ============ UI Rendering ============
function renderMatches(matches, filter) {
    const container = document.getElementById('matches-container');
    allMatchesCache = matches;

    if (!matches || matches.length === 0) {
        container.innerHTML = `<div class="favorite-empty">${getTranslation('noMatches')}</div>`;
        return;
    }

    let filtered = matches;
    if (filter && filter !== 'all') {
        filtered = matches.filter(m =>
            m.competition?.code === filter ||
            String(m.competition?.id) === String(filter)
        );
    }

    if (filtered.length === 0) {
        container.innerHTML = `<div class="favorite-empty">${getTranslation('noMatches')}</div>`;
        return;
    }

    // FIX: single .join('') — the original had two closing brackets causing a syntax crash
    container.innerHTML = filtered.map(match => {
        const homeTeam = match.homeTeam;
        const awayTeam = match.awayTeam;
        const matchId  = match.id;
        const homeScore = match.score?.fullTime?.home;
        const awayScore = match.score?.fullTime?.away;
        const scoreDisplay = (homeScore !== null && homeScore !== undefined &&
                              awayScore !== null && awayScore !== undefined)
            ? `${homeScore} - ${awayScore}`
            : '-';

        return `
        <div class="match-card" onclick="showMatchDetails(${matchId})">
            <div class="match-status ${getMatchStatusClass(match)}">
                ${getMatchStatus(match)}
            </div>
            <div class="match-league">${match.competition?.name || 'Unknown League'}</div>

            <div class="match-score">
                <div class="team">
                    <div class="team-logo">
                        ${homeTeam?.crest
                            ? `<img src="${homeTeam.crest}" alt="${homeTeam.name}" onerror="this.style.display='none'">`
                            : '<span>🏠</span>'}
                    </div>
                    <div class="team-name">${homeTeam?.name || homeTeam?.shortName || 'TBD'}</div>
                </div>

                <div class="score">${scoreDisplay}</div>

                <div class="team">
                    <div class="team-logo">
                        ${awayTeam?.crest
                            ? `<img src="${awayTeam.crest}" alt="${awayTeam.name}" onerror="this.style.display='none'">`
                            : '<span>✈️</span>'}
                    </div>
                    <div class="team-name">${awayTeam?.name || awayTeam?.shortName || 'TBD'}</div>
                </div>
            </div>

            <div class="match-time">
                ${new Date(match.utcDate).toLocaleTimeString(
                    currentLanguage === 'ar' ? 'ar-EG' : 'en-GB',
                    { hour: '2-digit', minute: '2-digit' }
                )}
            </div>

            <button class="star-btn ${favorites.includes(matchId) ? 'active' : ''}"
                    onclick="toggleFavorite(event, ${matchId})">⭐</button>
        </div>`;
    }).join('');   // FIX: only ONE .join('') here
}

function renderStandings(standings) {
    const container = document.getElementById('standings-container');

    if (!standings || standings.length === 0) {
        container.innerHTML = `<div class="favorite-empty">${getTranslation('noMatches')}</div>`;
        return;
    }

    const headers = currentLanguage === 'ar'
        ? ['الترتيب', 'الفريق', 'اللعب', 'الفوز', 'التعادل', 'الخسارة', 'فارق الأهداف', 'النقاط']
        : ['Pos', 'Team', 'P', 'W', 'D', 'L', 'GD', 'Pts'];

    container.innerHTML = `
        <table>
            <thead>
                <tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>
            </thead>
            <tbody>
                ${standings.map(team => {
                    const gf = team.goalsFor  ?? 0;
                    const ga = team.goalsAgainst ?? 0;
                    return `
                    <tr>
                        <td>${team.position}</td>
                        <td>
                            <div class="team-cell">
                                ${team.team?.crest
                                    ? `<img src="${team.team.crest}" alt="${team.team.name}" style="width:20px;margin-right:6px;" onerror="this.style.display='none'">`
                                    : ''}
                                ${team.team?.name || team.name}
                            </div>
                        </td>
                        <td>${team.playedGames ?? '-'}</td>
                        <td>${team.won ?? '-'}</td>
                        <td>${team.draw ?? '-'}</td>
                        <td>${team.lost ?? '-'}</td>
                        <td>${gf - ga}</td>
                        <td><strong>${team.points}</strong></td>
                    </tr>`;
                }).join('')}
            </tbody>
        </table>`;
}

// FIX: renderFavorites — was using m.fixture.id, API returns m.id
function renderFavorites() {
    const container = document.getElementById('favorites-container');

    if (favorites.length === 0) {
        container.innerHTML = `<div class="favorite-empty">${getTranslation('noFavorites')}</div>`;
        return;
    }

    const favMatches = allMatchesCache.filter(m => favorites.includes(m.id));

    if (favMatches.length === 0) {
        container.innerHTML = `<div class="favorite-empty">${getTranslation('noFavorites')}</div>`;
        return;
    }

    renderMatches(favMatches, 'all');
}

// ============ Match Details Modal ============
// FIX: uses football-data.org schema (homeTeam/awayTeam/score) not RapidAPI schema
async function showMatchDetails(matchId) {
    const modal    = document.getElementById('matchModal');
    const modalBody = document.getElementById('modalBody');

    // Try to get from cache first
    let match = allMatchesCache.find(m => m.id == matchId) || null;

    if (!match && API_KEY) {
        showLoading(true);
        match = await fetchMatchDetails(matchId);
        showLoading(false);
    }

    if (!match) {
        showNotification(getTranslation('error'));
        return;
    }

    const homeTeam  = match.homeTeam;
    const awayTeam  = match.awayTeam;
    const homeScore = match.score?.fullTime?.home;
    const awayScore = match.score?.fullTime?.away;
    const scoreStr  = (homeScore !== null && homeScore !== undefined &&
                       awayScore !== null && awayScore !== undefined)
        ? `${homeScore} - ${awayScore}` : '-';

    modalBody.innerHTML = `
        <div class="modal-header">
            <h2>${match.competition?.name || ''}</h2>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:15px;">
                <div style="text-align:center;">
                    ${homeTeam?.crest
                        ? `<img src="${homeTeam.crest}" alt="${homeTeam.name}" style="width:60px;margin-bottom:10px;" onerror="this.style.display='none'">`
                        : '<span style="font-size:40px;">🏠</span>'}
                    <div>${homeTeam?.name || 'Home'}</div>
                </div>
                <div class="modal-score">${scoreStr}</div>
                <div style="text-align:center;">
                    ${awayTeam?.crest
                        ? `<img src="${awayTeam.crest}" alt="${awayTeam.name}" style="width:60px;margin-bottom:10px;" onerror="this.style.display='none'">`
                        : '<span style="font-size:40px;">✈️</span>'}
                    <div>${awayTeam?.name || 'Away'}</div>
                </div>
            </div>
            <div style="margin-top:10px;font-size:14px;color:#4f9cff;">
                ${getMatchStatus(match)}
            </div>
        </div>
        <div class="match-stats" style="margin-top:20px;">
            <div class="stats-row">
                <span>${currentLanguage === 'ar' ? 'الحالة' : 'Status'}</span>
                <span>${getMatchStatus(match)}</span>
            </div>
            <div class="stats-row">
                <span>${currentLanguage === 'ar' ? 'الدوري' : 'Competition'}</span>
                <span>${match.competition?.name || '-'}</span>
            </div>
            <div class="stats-row">
                <span>${currentLanguage === 'ar' ? 'الوقت' : 'Time'}</span>
                <span>${new Date(match.utcDate).toLocaleTimeString(
                    currentLanguage === 'ar' ? 'ar-EG' : 'en-GB',
                    { hour: '2-digit', minute: '2-digit' }
                )}</span>
            </div>
        </div>`;

    modal.classList.add('active');
}

// ============ Helper Functions ============
function getMatchStatus(match) {
    const statusMap = {
        'SCHEDULED': getTranslation('notStarted'),
        'TIMED':     getTranslation('notStarted'),
        'IN_PLAY':   getTranslation('live'),
        'PAUSED':    getTranslation('live'),
        'FINISHED':  getTranslation('finished'),
        'POSTPONED': 'Postponed',
        'CANCELLED': 'Cancelled',
        'SUSPENDED': 'Suspended',
    };
    return statusMap[match.status] || match.status || '-';
}

function getMatchStatusClass(match) {
    if (['IN_PLAY', 'PAUSED'].includes(match.status)) return 'live';
    if (match.status === 'FINISHED') return 'finished';
    return 'upcoming';
}

function getTranslation(key) {
    return translations[currentLanguage][key] || key;
}

function showLoading(show) {
    document.getElementById('loading').classList.toggle('active', show);
}

function showNotification(message) {
    const el = document.createElement('div');
    el.textContent = message;
    el.style.cssText = 'position:fixed;top:20px;right:20px;background:rgba(255,69,0,0.92);color:white;padding:14px 20px;border-radius:8px;z-index:2000;font-size:14px;max-width:320px;';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 4000);
}

// FIX: toggleFavorite — was using fixtureId from wrong schema; now uses m.id consistently
function toggleFavorite(e, matchId) {
    e.stopPropagation();
    const idx = favorites.indexOf(matchId);
    if (idx > -1) {
        favorites.splice(idx, 1);
    } else {
        favorites.push(matchId);
    }
    localStorage.setItem('favorites', JSON.stringify(favorites));
    e.target.closest('button').classList.toggle('active');
}

function switchLanguage() {
    currentLanguage = currentLanguage === 'ar' ? 'en' : 'ar';
    const html = document.documentElement;
    html.lang = currentLanguage;
    html.dir  = currentLanguage === 'ar' ? 'rtl' : 'ltr';
    document.getElementById('langBtn').textContent = currentLanguage === 'ar' ? 'English' : 'العربية';

    document.querySelectorAll('.ar, .en').forEach(el => {
        el.style.display = el.classList.contains(currentLanguage) ? 'inline' : 'none';
    });

    const activeTab = document.querySelector('.nav-btn.active');
    if (activeTab) activeTab.click();
}

// ============ Date Navigation ============
function updateDateDisplay() {
    document.getElementById('selectedDate').value = selectedDate;
}

function changeDate(days) {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    selectedDate = d.toISOString().split('T')[0];
    updateDateDisplay();
    loadMatchesForSelectedDate();
}

async function loadMatchesForSelectedDate() {
    const matches = await fetchMatches(selectedDate);
    const filter  = document.getElementById('leagueFilter').value;
    renderMatches(matches, filter);
}

// ============ Event Listeners ============
document.addEventListener('DOMContentLoaded', function () {
    updateDateDisplay();

    document.getElementById('langBtn').addEventListener('click', switchLanguage);

    document.getElementById('refreshBtn').addEventListener('click', loadMatchesForSelectedDate);

    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', async function () {
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));

            this.classList.add('active');
            const tab = this.dataset.tab;
            document.getElementById(`${tab}-tab`).classList.add('active');

            if (tab === 'matches') {
                await loadMatchesForSelectedDate();
            } else if (tab === 'standings') {
                const league = document.getElementById('standingsLeague').value;
                renderStandings(await fetchStandings(league));
            } else if (tab === 'favorites') {
                renderFavorites();
            }
        });
    });

    document.getElementById('prevDay').addEventListener('click', () => changeDate(-1));
    document.getElementById('nextDay').addEventListener('click', () => changeDate(1));
    document.getElementById('selectedDate').addEventListener('change', function () {
        selectedDate = this.value;
        loadMatchesForSelectedDate();
    });

    document.getElementById('leagueFilter').addEventListener('change', function () {
        renderMatches(allMatchesCache, this.value);
    });

    document.getElementById('standingsLeague').addEventListener('change', async function () {
        renderStandings(await fetchStandings(this.value));
    });

    document.querySelector('.close').addEventListener('click', () => {
        document.getElementById('matchModal').classList.remove('active');
    });

    window.addEventListener('click', e => {
        const modal = document.getElementById('matchModal');
        if (e.target === modal) modal.classList.remove('active');
    });

    // Initial load
    loadMatchesForSelectedDate();

    // Auto-refresh every 30s when on matches tab
    setInterval(() => {
        if (document.querySelector('.nav-btn.active')?.dataset.tab === 'matches') {
            loadMatchesForSelectedDate();
        }
    }, 30000);
});
