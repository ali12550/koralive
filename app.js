// ============ Configuration ============
// TheSportsDB free tier — no API key required
const API_BASE = 'https://www.thesportsdb.com/api/v1/json/3';

// Short code → TheSportsDB league info
const LEAGUE_MAP = {
    PL:  { id: '4328', name: 'English Premier League' },
    LA:  { id: '4335', name: 'Spanish La Liga'        },
    SA:  { id: '4332', name: 'Italian Serie A'        },
    BL1: { id: '4331', name: 'German Bundesliga'      },
    FL1: { id: '4334', name: 'French Ligue 1'         },
};

const CURRENT_SEASON = '2024-2025';

// ============ State ============
let currentLanguage = 'ar';
let favorites = JSON.parse(localStorage.getItem('favorites')) || [];
let selectedDate = new Date().toISOString().split('T')[0];

// ============ Translations ============
const translations = {
    ar: {
        matches: 'المباريات',
        standings: 'الترتيب',
        favorites: 'المفضلة',
        loading: 'جاري التحميل...',
        notStarted: 'لم تبدأ بعد',
        live: 'مباشر',
        finished: 'انتهت',
        goals: 'الأهداف',
        noMatches: 'لا توجد مباريات متاحة',
        noFavorites: 'لم تضف أي مباريات للمفضلة بعد',
    },
    en: {
        matches: 'Matches',
        standings: 'Standings',
        favorites: 'Favorites',
        loading: 'Loading...',
        notStarted: 'Not Started',
        live: 'LIVE',
        finished: 'Finished',
        goals: 'Goals',
        noMatches: 'No matches available',
        noFavorites: 'No favorite matches added yet',
    }
};

// ============ Data Normalization ============
function getLeagueCode(leagueName) {
    const entry = Object.entries(LEAGUE_MAP).find(([, v]) => v.name === leagueName);
    return entry ? entry[0] : null;
}

function normalizeEvent(ev) {
    const raw = ev.strStatus || '';
    let status;
    if (['Match Finished', 'FT', 'AET', 'AP'].includes(raw)) {
        status = 'FINISHED';
    } else if (['Not Started', '', 'NS'].includes(raw)) {
        status = 'SCHEDULED';
    } else {
        status = 'IN_PLAY'; // 1H, HT, 2H, ET, etc.
    }

    const homeScore = ev.intHomeScore !== null && ev.intHomeScore !== '' ? parseInt(ev.intHomeScore) : null;
    const awayScore = ev.intAwayScore !== null && ev.intAwayScore !== '' ? parseInt(ev.intAwayScore) : null;

    return {
        id: ev.idEvent,
        status,
        competition: { name: ev.strLeague, code: getLeagueCode(ev.strLeague) },
        homeTeam: { name: ev.strHomeTeam, crest: ev.strHomeTeamBadge },
        awayTeam: { name: ev.strAwayTeam, crest: ev.strAwayTeamBadge },
        score: { fullTime: { home: homeScore, away: awayScore } },
        utcDate: `${ev.dateEvent}T${ev.strTime || '00:00:00'}Z`,
    };
}

function normalizeTableRow(t) {
    return {
        position: parseInt(t.intRank) || 0,
        team: { name: t.strTeam, crest: t.strTeamBadge },
        playedGames: parseInt(t.intPlayed) || 0,
        won: parseInt(t.intWin) || 0,
        draw: parseInt(t.intDraw) || 0,
        lost: parseInt(t.intLoss) || 0,
        goalsFor: parseInt(t.intGoalsFor) || 0,
        goalsAgainst: parseInt(t.intGoalsAgainst) || 0,
        points: parseInt(t.intPoints) || 0,
    };
}

// ============ API Functions ============
async function fetchMatches(date) {
    try {
        showLoading(true);
        const response = await fetch(`${API_BASE}/eventsday.php?d=${date}&s=Soccer`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        const events = (data.events || []).map(normalizeEvent);
        if (events.length > 0) cacheMatchData(date, events);
        return events;
    } catch (error) {
        console.error('Error fetching matches:', error);
        showNotification('⚠️ Using cached data');
        return getLocalCacheData(date);
    } finally {
        showLoading(false);
    }
}

async function fetchStandings(leagueCode) {
    try {
        showLoading(true);
        const league = LEAGUE_MAP[leagueCode];
        if (!league) return [];
        const response = await fetch(`${API_BASE}/lookuptable.php?l=${league.id}&s=${CURRENT_SEASON}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        return (data.table || []).map(normalizeTableRow);
    } catch (error) {
        console.error('Error fetching standings:', error);
        showNotification('خطأ في تحميل الترتيب / Error loading standings');
        return [];
    } finally {
        showLoading(false);
    }
}

async function fetchMatchDetails(eventId) {
    try {
        const response = await fetch(`${API_BASE}/lookupevent.php?id=${eventId}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        const events = data.events || [];
        return events.length > 0 ? normalizeEvent(events[0]) : null;
    } catch (error) {
        console.error('Error fetching match details:', error);
        return null;
    }
}

// ============ Cache ============
function getLocalCacheData(date) {
    const cached = localStorage.getItem(`matches_${date}`);
    return cached ? JSON.parse(cached) : [];
}

function cacheMatchData(date, data) {
    localStorage.setItem(`matches_${date}`, JSON.stringify(data));
}

// ============ UI Rendering ============
function renderMatches(matches, filter = 'all') {
    const container = document.getElementById('matches-container');

    if (!matches || matches.length === 0) {
        container.innerHTML = `<div class="favorite-empty">${getTranslation('noMatches')}</div>`;
        return;
    }

    const filteredMatches = filter === 'all' ? matches : matches.filter(m => {
        const leagueInfo = LEAGUE_MAP[filter];
        return m.competition?.code === filter || m.competition?.name === leagueInfo?.name;
    });

    if (filteredMatches.length === 0) {
        container.innerHTML = `<div class="favorite-empty">${getTranslation('noMatches')}</div>`;
        return;
    }

    container.innerHTML = filteredMatches.map(match => {
        const matchId = match.id;
        const score = match.score?.fullTime;
        const hasScore = score?.home !== null && score?.away !== null;

        return `
        <div class="match-card" onclick="showMatchDetails('${matchId}')">
            <div class="match-status ${getMatchStatusClass(match)}">
                ${getMatchStatus(match)}
            </div>
            <div class="match-league">${match.competition?.name || ''}</div>
            <div class="match-score">
                <div class="team">
                    <div class="team-logo">
                        ${match.homeTeam?.crest
                            ? `<img src="${match.homeTeam.crest}" alt="${match.homeTeam.name}" onerror="this.parentNode.innerHTML='🏠'">`
                            : '<span>🏠</span>'}
                    </div>
                    <div class="team-name">${match.homeTeam?.name || 'TBD'}</div>
                </div>
                <div class="score">${hasScore ? `${score.home} - ${score.away}` : '-'}</div>
                <div class="team">
                    <div class="team-logo">
                        ${match.awayTeam?.crest
                            ? `<img src="${match.awayTeam.crest}" alt="${match.awayTeam.name}" onerror="this.parentNode.innerHTML='✈️'">`
                            : '<span>✈️</span>'}
                    </div>
                    <div class="team-name">${match.awayTeam?.name || 'TBD'}</div>
                </div>
            </div>
            <div class="match-time">
                ${new Date(match.utcDate).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
            </div>
            <div class="match-channel">⚽ ${getMatchStatus(match)}</div>
            <button class="star-btn ${favorites.includes(matchId) ? 'active' : ''}"
                    onclick="toggleFavorite(event, '${matchId}')">⭐</button>
        </div>`;
    }).join('');
}

function renderStandings(standings) {
    const container = document.getElementById('standings-container');

    if (!standings || standings.length === 0) {
        container.innerHTML = `<div class="favorite-empty">${getTranslation('noMatches')}</div>`;
        return;
    }

    const headerText = currentLanguage === 'ar'
        ? ['الترتيب', 'الفريق', 'اللعب', 'الفوز', 'التعادل', 'الخسارة', 'الأهداف', 'النقاط']
        : ['Pos', 'Team', 'P', 'W', 'D', 'L', 'GD', 'Pts'];

    container.innerHTML = `
        <table>
            <thead><tr>${headerText.map(h => `<th>${h}</th>`).join('')}</tr></thead>
            <tbody>
                ${standings.map(team => `
                    <tr>
                        <td>${team.position}</td>
                        <td>
                            <div class="team-cell">
                                ${team.team?.crest ? `<img src="${team.team.crest}" alt="${team.team.name}">` : ''}
                                ${team.team?.name || ''}
                            </div>
                        </td>
                        <td>${team.playedGames}</td>
                        <td>${team.won}</td>
                        <td>${team.draw}</td>
                        <td>${team.lost}</td>
                        <td>${team.goalsFor - team.goalsAgainst}</td>
                        <td><strong>${team.points}</strong></td>
                    </tr>`).join('')}
            </tbody>
        </table>`;
}

function renderFavorites(allMatches) {
    const container = document.getElementById('favorites-container');

    if (favorites.length === 0) {
        container.innerHTML = `<div class="favorite-empty">${getTranslation('noFavorites')}</div>`;
        return;
    }

    const favoriteMatches = allMatches.filter(m => favorites.includes(m.id));

    if (favoriteMatches.length === 0) {
        container.innerHTML = `<div class="favorite-empty">${getTranslation('noFavorites')}</div>`;
        return;
    }

    renderMatches(favoriteMatches);
}

// ============ Match Details Modal ============
async function showMatchDetails(eventId) {
    const modal = document.getElementById('matchModal');
    const modalBody = document.getElementById('modalBody');

    showLoading(true);
    const match = await fetchMatchDetails(eventId);
    showLoading(false);

    if (!match) {
        showNotification('Unable to load match details');
        return;
    }

    const score = match.score?.fullTime;
    const hasScore = score?.home !== null && score?.away !== null;

    modalBody.innerHTML = `
        <div class="modal-header">
            <h2>${match.competition?.name || ''}</h2>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:15px;">
                <div style="text-align:center;">
                    ${match.homeTeam?.crest
                        ? `<img src="${match.homeTeam.crest}" alt="${match.homeTeam.name}" style="width:60px; margin-bottom:10px;">`
                        : ''}
                    <div>${match.homeTeam?.name || ''}</div>
                </div>
                <div class="modal-score">${hasScore ? `${score.home} - ${score.away}` : '-'}</div>
                <div style="text-align:center;">
                    ${match.awayTeam?.crest
                        ? `<img src="${match.awayTeam.crest}" alt="${match.awayTeam.name}" style="width:60px; margin-bottom:10px;">`
                        : ''}
                    <div>${match.awayTeam?.name || ''}</div>
                </div>
            </div>
            <div style="margin-top:10px; font-size:14px; color:#4f9cff;">
                ${getMatchStatus(match)}
            </div>
        </div>
        <div class="match-stats">
            <h3>${getTranslation('goals')}</h3>
            <div class="stats-row">
                <span>${match.homeTeam?.name || ''}</span>
                <span>${hasScore ? score.home : '-'}</span>
            </div>
            <div class="stats-row">
                <span>${match.awayTeam?.name || ''}</span>
                <span>${hasScore ? score.away : '-'}</span>
            </div>
        </div>`;

    modal.classList.add('active');
}

// ============ Helpers ============
function getMatchStatus(match) {
    const statusMap = {
        SCHEDULED: getTranslation('notStarted'),
        IN_PLAY:   getTranslation('live'),
        PAUSED:    getTranslation('live'),
        LIVE:      getTranslation('live'),
        FINISHED:  getTranslation('finished'),
        POSTPONED: 'Postponed',
        CANCELLED: 'Cancelled',
        SUSPENDED: 'Suspended',
    };
    return statusMap[match.status] || match.status || '';
}

function getMatchStatusClass(match) {
    if (['IN_PLAY', 'PAUSED', 'LIVE'].includes(match.status)) return 'live';
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
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = `
        position:fixed; top:20px; right:20px;
        background:rgba(255,69,0,0.9); color:#fff;
        padding:15px 20px; border-radius:6px; z-index:2000;`;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
}

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
    html.dir = currentLanguage === 'ar' ? 'rtl' : 'ltr';
    document.getElementById('langBtn').textContent = currentLanguage === 'ar' ? 'English' : 'العربية';

    document.querySelectorAll('.ar, .en').forEach(el => {
        el.style.display =
            (el.classList.contains('ar') && currentLanguage === 'ar') ||
            (el.classList.contains('en') && currentLanguage === 'en')
                ? 'inline' : 'none';
    });

    document.querySelector('.nav-btn.active')?.click();
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
    const filter = document.getElementById('leagueFilter').value;
    renderMatches(matches, filter);
}

// ============ Event Listeners ============
document.addEventListener('DOMContentLoaded', function () {
    updateDateDisplay();

    document.getElementById('langBtn').addEventListener('click', switchLanguage);

    document.getElementById('refreshBtn').addEventListener('click', async () => {
        await loadMatchesForSelectedDate();
    });

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
                const matches = await fetchMatches(selectedDate);
                renderFavorites(matches);
            }
        });
    });

    document.getElementById('prevDay').addEventListener('click', () => changeDate(-1));
    document.getElementById('nextDay').addEventListener('click', () => changeDate(1));
    document.getElementById('selectedDate').addEventListener('change', function () {
        selectedDate = this.value;
        loadMatchesForSelectedDate();
    });

    document.getElementById('leagueFilter').addEventListener('change', async function () {
        const matches = await fetchMatches(selectedDate);
        renderMatches(matches, this.value);
    });

    document.getElementById('standingsLeague').addEventListener('change', async function () {
        renderStandings(await fetchStandings(this.value));
    });

    document.querySelector('.close').addEventListener('click', function () {
        document.getElementById('matchModal').classList.remove('active');
    });

    window.addEventListener('click', function (e) {
        const modal = document.getElementById('matchModal');
        if (e.target === modal) modal.classList.remove('active');
    });

    loadMatchesForSelectedDate();

    // Auto-refresh every 60 seconds when on matches tab
    setInterval(() => {
        if (document.querySelector('.nav-btn.active')?.dataset.tab === 'matches') {
            loadMatchesForSelectedDate();
        }
    }, 60000);
});