# Configuration Guide - دليل الإعدادات

## 🔑 API Configuration

### Getting Your API Key

1. **Visit RapidAPI**
   - Go to: https://rapidapi.com
   - Click "Sign Up" (top right)

2. **Create Account**
   - Choose "Sign up as a Developer"
   - Fill in your details
   - Verify email

3. **Find API-Football**
   - Search for "API-Football"
   - Click on "API-Football" by api-sports
   - Read the description

4. **Subscribe (Free)**
   - Click "Subscribe to Test"
   - Select "Free" plan
   - Accept terms

5. **Get Your Key**
   - Go to "Endpoints" tab
   - Copy "X-RapidAPI-Key" value
   - This is your API_KEY

### Update Your API Key

**Method 1: Direct Edit**
```javascript
// In app.js, line 2
const API_KEY = 'your-api-key-here';
```

**Method 2: Environment Variable (For Deployment)**
```bash
# Set in your hosting platform
API_KEY=your-api-key-here
```

---

## 🖥️ Server Setup

### On Windows

```powershell
# Using Python (Recommended)
python -m http.server 8000

# Or with PowerShell
python -m http.server -p 8000

# Or using Node.js
npx http-server -p 8000 -o
```

### On Mac

```bash
# Using Python 3
python3 -m http.server 8000

# Or using Node.js
npx http-server -p 8000 -o
```

### On Linux

```bash
# Using Python 3
python3 -m http.server 8000

# Or simple server
cd /path/to/kora-live && python3 -m http.server 8000
```

### Access Your App
- Open browser: `http://localhost:8000`
- Or: `http://127.0.0.1:8000`
- Or on mobile: `http://YOUR_IP:8000`

---

## 🌐 Deployment Configurations

### Netlify Configuration

**Create `netlify.toml`:**
```toml
[build]
  command = "echo 'No build needed'"
  publish = "."

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[context.production.environment]
  API_KEY = "your-api-key"
```

**Environment Variables:**
1. Go to Site Settings → Build & Deploy
2. Add Variable: `API_KEY` = your key
3. Redeploy

### Vercel Configuration

**Create `vercel.json`:**
```json
{
  "buildCommand": "echo 'Static site'",
  "outputDirectory": ".",
  "env": {
    "API_KEY": "your-api-key"
  }
}
```

### GitHub Pages

No special config needed. Just:
1. Push to GitHub
2. Enable Pages in Settings
3. Deploy from main branch

---

## 🎨 Theme Configuration

### Color Customization

Edit in `styles.css`:

```css
/* Primary Blue */
--primary: #2d5aa8;

/* Accent Blue */
--accent: #4f9cff;

/* Dark Background */
--dark-bg: #1e1e2e;
--dark-accent: #2d2d44;

/* Text Colors */
--light-text: #f0f0f0;
--secondary-text: #b0b0b0;
```

### Quick Theme Change

```css
/* Dark Theme (Default) */
body {
  background: linear-gradient(135deg, #1e1e2e 0%, #2d2d44 100%);
  color: #f0f0f0;
}

/* Light Theme Alternative */
body {
  background: linear-gradient(135deg, #f5f5f5 0%, #e8e8e8 100%);
  color: #1a1a1a;
}

/* Green Theme */
body {
  background: linear-gradient(135deg, #0d3b0d 0%, #1a5e1a 100%);
  color: #f0f0f0;
}
```

---

## 📡 API Rate Limits

### Free Tier Limits
- **Daily**: 100 requests/day
- **Per second**: 5 requests/second
- **Concurrent**: 1 connection

### Optimize Usage
1. **Cache Results** - Reuse data when possible
2. **Batch Requests** - Combine multiple calls
3. **Increase Refresh Interval** - Change from 30s to 60s

```javascript
// In app.js, find this line and change:
setInterval(() => {
    // Refresh code
}, 60000); // Changed from 30000 to 60000 (1 minute)
```

---

## 🛡️ Security Best Practices

### Production Deployment

**Never commit API keys:**
```bash
# Create .gitignore
echo "config.local.js" > .gitignore
```

**Use Environment Variables:**
```javascript
// Instead of hardcoding
const API_KEY = process.env.API_KEY;
```

**Implement Backend Proxy:**
```javascript
// Call your backend
fetch('/api/matches')
  .then(res => res.json())
  // Backend handles API_KEY securely
```

---

## 📊 Data Configuration

### Supported Leagues

```javascript
// Edit in index.html if adding/removing leagues
const LEAGUES = {
  'PL': 'Premier League (England)',
  'LA': 'La Liga (Spain)',
  'SA': 'Serie A (Italy)',
  'BL1': 'Bundesliga (Germany)',
  'FL1': 'Ligue 1 (France)',
};
```

### Add New League
1. Find the `<select id="leagueFilter">` in index.html
2. Add new option:
```html
<option value="LEAGUE_ID">League Name</option>
```

### Find League IDs
- Visit: https://api-football.com/documentation-v3
- Check "Leagues" endpoint
- Find your league ID

---

## 🔄 Auto-Refresh Configuration

### Current Setting
- Refreshes every 30 seconds when on Matches tab

### Change Refresh Rate

```javascript
// In app.js, find:
setInterval(() => {
    if (document.querySelector('.nav-btn.active').data-tab === 'matches') {
        loadMatchesForSelectedDate();
    }
}, 30000); // <- CHANGE THIS NUMBER

// 10 seconds = 10000
// 30 seconds = 30000 (current)
// 60 seconds = 60000
```

---

## 🗣️ Language Configuration

### Default Language
```javascript
// In app.js, line 12
let currentLanguage = 'ar'; // 'ar' or 'en'
```

### Add New Language

1. Add translations in `translations` object:
```javascript
const translations = {
  ar: { /* ... */ },
  en: { /* ... */ },
  fr: { // French example
    matches: 'Matchs',
    standings: 'Classements',
    // ... add all keys
  }
};
```

2. Update language switch:
```javascript
function switchLanguage() {
    const langs = ['ar', 'en', 'fr'];
    const current = langs.indexOf(currentLanguage);
    currentLanguage = langs[(current + 1) % langs.length];
    // ... rest of code
}
```

---

## 🧪 Testing Configuration

### Browser DevTools

**Enable Console Logging:**
```javascript
// Add to app.js for debugging
const DEBUG = true;

function log(...args) {
    if (DEBUG) console.log(...args);
}
```

**Check API Responses:**
1. Open DevTools (F12)
2. Go to Network tab
3. Refresh page
4. Check API calls

---

## 📦 Backup & Restore

### Create Backup
```bash
# Create backup folder
cp -r kora-live kora-live-backup

# Or zip it
tar -czf kora-live-backup.tar.gz kora-live
```

### Restore Backup
```bash
# Extract backup
tar -xzf kora-live-backup.tar.gz
```

### Version Control
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin YOUR_REPO
git push origin main
```

---

## ✅ Configuration Checklist

- [ ] API key obtained from RapidAPI
- [ ] API key added to app.js
- [ ] Local server running
- [ ] App opens in browser
- [ ] Matches loading correctly
- [ ] Language switch working
- [ ] Favorites feature working
- [ ] Mobile responsive test done
- [ ] API rate limits understood
- [ ] Deployment platform chosen (if needed)

---

## 🆘 Quick Troubleshooting

| Issue | Solution |
|-------|----------|
| API errors | Verify API key and subscription |
| CORS errors | Use local server, not direct open |
| Slow loading | Increase refresh interval |
| No matches | Try different date/league |
| Memory leak | Close old browser tabs |

---

**Configuration complete! Your app is ready to use.** 🚀
