const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================
// AUTO-DISCOVERY: Registers a route for every subdirectory
// inside public/. Adding a new dashboard folder automatically
// makes it accessible — no server.js edit required.
// ============================================================
const publicDir = path.join(__dirname, 'public');
fs.readdirSync(publicDir, { withFileTypes: true })
  .filter(entry => entry.isDirectory())
  .forEach(dir => {
    const route = '/' + dir.name;
    app.use(route, express.static(path.join(publicDir, dir.name)));
    console.log('  Registered dashboard route:', route);
  });

// Landing page
app.get('/', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

// Catch-all: redirect unknown paths to landing
app.use((req, res) => {
  res.redirect('/');
});

app.listen(PORT, () => {
  console.log('Blackstone dashboards running on port ' + PORT);
  console.log('Dashboard routes auto-discovered from public/ subdirectories');
});
// deploy-1775508575
