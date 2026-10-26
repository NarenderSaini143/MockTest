const fs = require('fs');
const path = require('path');

const FEED_URL = 'https://mocktest.gkget.com/api/pinterest-feed';
const SITE_URL = 'https://mocktest.gkget.com';

function unescapeXml(str = '') {
  return str
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&');
}

function getFormattedDate(d = new Date()) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function getReadableDate(d = new Date()) {
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

async function run() {
  console.log(`[1/4] Fetching RSS feed from: ${FEED_URL}...`);
  const res = await fetch(FEED_URL);
  if (!res.ok) {
    throw new Error(`Failed to fetch RSS: ${res.status} ${res.statusText}`);
  }
  const xml = await res.text();

  console.log('[2/4] Parsing questions...');
  const itemMatches = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];
  if (!itemMatches.length) {
    console.warn('No <item> elements found in feed.');
    return;
  }

  const questions = itemMatches.map((m, idx) => {
    const raw = m[1];
    const rawTitle = (raw.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || `Question ${idx + 1}`;
    const rawLink = (raw.match(/<link>([\s\S]*?)<\/link>/) || [])[1] || SITE_URL;
    const rawImg = (raw.match(/<enclosure[^>]+url="([^"]+)"/) || raw.match(/<media:content[^>]+url="([^"]+)"/) || [])[1] || '';

    const title = unescapeXml(rawTitle.trim());
    const link = unescapeXml(rawLink.trim());
    const imageUrl = unescapeXml(rawImg.trim());

    // Extract options from imageUrl params if present
    let optA = '', optB = '', optC = '', optD = '';
    try {
      if (imageUrl.includes('?')) {
        const parsedUrl = new URL(imageUrl);
        optA = parsedUrl.searchParams.get('optA') || '';
        optB = parsedUrl.searchParams.get('optB') || '';
        optC = parsedUrl.searchParams.get('optC') || '';
        optD = parsedUrl.searchParams.get('optD') || '';
      }
    } catch (e) {}

    return {
      index: idx + 1,
      title,
      link,
      imageUrl,
      options: [optA, optB, optC, optD].filter(Boolean)
    };
  });

  console.log(`Parsed ${questions.length} questions successfully.`);

  const now = new Date();
  const dateKey = getFormattedDate(now);
  const readableDate = getReadableDate(now);

  const rootDir = path.resolve(__dirname, '..');
  const dailyDir = path.join(rootDir, 'daily');
  if (!fs.existsSync(dailyDir)) {
    fs.mkdirSync(dailyDir, { recursive: true });
  }

  // 1. Generate Daily File: daily/YYYY-MM-DD.md
  console.log(`[3/4] Creating daily page: daily/${dateKey}.md...`);
  let dailyContent = `# दैनिक सामान्य ज्ञान प्रश्नोत्तरी - ${readableDate}\n\n`;
  dailyContent += `> 🎯 **ऑनलाइन टेस्ट और प्रैक्टिस:** [GKGet (mocktest.gkget.com)](${SITE_URL}) पर SSC, Railway, UPSC, Banking और State PSC परीक्षाओं के 100,000+ सॉल्व्ड प्रश्नों का अभ्यास करें।\n\n`;
  dailyContent += `---\n\n`;

  questions.forEach(q => {
    dailyContent += `### प्रश्न ${q.index}: ${q.title}\n\n`;
    if (q.imageUrl) {
      dailyContent += `![${q.title}](${q.imageUrl})\n\n`;
    }
    if (q.options.length >= 4) {
      dailyContent += `- **(A)** ${q.options[0]}\n`;
      dailyContent += `- **(B)** ${q.options[1]}\n`;
      dailyContent += `- **(C)** ${q.options[2]}\n`;
      dailyContent += `- **(D)** ${q.options[3]}\n\n`;
    }
    dailyContent += `👉 **[सही उत्तर और व्याख्या यहाँ देखें](${q.link})**\n\n`;
    dailyContent += `---\n\n`;
  });

  dailyContent += `## 📚 महत्वपूर्ण विषय (Important Subjects on GKGet)\n\n`;
  dailyContent += `- 🏛️ [भारतीय इतिहास (History Solved MCQs)](${SITE_URL})\n`;
  dailyContent += `- 🌍 [भारत एवं विश्व भूगोल (Geography Tests)](${SITE_URL})\n`;
  dailyContent += `- ⚖️ [भारतीय संविधान एवं राजव्यवस्था (Indian Polity)](${SITE_URL})\n`;
  dailyContent += `- 🔬 [सामान्य विज्ञान (General Science Tests)](${SITE_URL})\n`;
  dailyContent += `- 📊 [भारतीय अर्थव्यवस्था (Economics MCQs)](${SITE_URL})\n\n`;
  dailyContent += `*Updated automatically via GitHub Actions from [GKGet RSS Feed](${FEED_URL})*\n`;

  fs.writeFileSync(path.join(dailyDir, `${dateKey}.md`), dailyContent, 'utf8');

  // 2. Generate / Update Master README.md
  console.log('[4/4] Updating README.md with Today\'s Questions & Archive...');
  
  // List all past daily quizzes in archive
  const allDailyFiles = fs.readdirSync(dailyDir)
    .filter(f => f.endsWith('.md'))
    .sort()
    .reverse();

  let archiveLinks = allDailyFiles.map(file => {
    const fDate = file.replace('.md', '');
    return `- 📅 **[दैनिक प्रश्नोत्तरी - ${fDate}](daily/${file})** (20 महत्वपूर्ण MCQs)`;
  }).join('\n');

  let todayList = questions.slice(0, 10).map(q => {
    return `${q.index}. [${q.title}](${q.link})`;
  }).join('\n');

  const readmeContent = `# GKGet - Daily Hindi GK Quizzes & Mock Tests 📚

[![Daily Question Sync](https://github.com/NarenderSaini143/MockTest/actions/workflows/daily_quiz.yml/badge.svg)](https://github.com/NarenderSaini143/MockTest/actions/workflows/daily_quiz.yml)

Welcome to the official daily practice repository for **[GKGet (mocktest.gkget.com)](${SITE_URL})**! This repository automatically publishes 20 fresh Hindi GK and General Studies multiple-choice questions (MCQs) every morning with verified answers and explanations.

---

### 🎯 Quick Links:
- 🌐 **[GKGet Online Mock Tests Homepage](${SITE_URL})**
- 📚 **[SSC, Railway & UPSC Solved Questions](${SITE_URL})**
- 📝 **[Today's Full 20 Quiz Page (with Question Cards)](daily/${dateKey}.md)**

---

## 📅 आज के महत्वपूर्ण प्रश्न (${readableDate})

${todayList}

👉 **[सभी 20 प्रश्न और व्याख्या कार्ड देखने के लिए यहाँ क्लिक करें »](daily/${dateKey}.md)**

---

## 🗂️ पिछले दिनों की प्रश्नोत्तरी (Daily Archive)

${archiveLinks}

---

### 📖 विषयवार मॉक टेस्ट (Subject-wise Tests on GKGet)
- 🏛️ **[भारतीय इतिहास (History Solved MCQs)](${SITE_URL})**
- ⚖️ **[भारतीय संविधान एवं राजव्यवस्था (Indian Polity)](${SITE_URL})**
- 🌍 **[भूगोल (Geography Practice MCQs)](${SITE_URL})**
- 🔬 **[सामान्य विज्ञान (General Science)](${SITE_URL})**
- 📊 **[भारतीय अर्थव्यवस्था (Indian Economy)](${SITE_URL})**

---

*Automated by [GKGet Automation Bot](${SITE_URL}) via GitHub Actions. Updated daily.*
`;

  fs.writeFileSync(path.join(rootDir, 'README.md'), readmeContent, 'utf8');
  console.log('✅ Successfully generated daily quiz page and updated README.md!');
}

run().catch(err => {
  console.error('Fatal error running generate_daily.js:', err);
  process.exit(1);
});
