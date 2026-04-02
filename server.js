const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use('/mediation-pipeline', express.static(path.join(__dirname, 'public', 'mediation-pipeline')));
app.use('/motion-dashboard', express.static(path.join(__dirname, 'public', 'motion-dashboard')));
app.use('/discovery-tracker', express.static(path.join(__dirname, 'public', 'discovery-tracker')));
app.use('/daily-briefing', express.static(path.join(__dirname, 'public', 'daily-briefing')));
app.use('/command-center', express.static(path.join(__dirname, 'public', 'command-center')));
app.use('/cmc-deadline-monitor', express.static(path.join(__dirname, 'public', 'cmc-deadline-monitor')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((req, res) => {
  res.redirect('/');
});

app.listen(PORT, () => {
  console.log(`Blackstone dashboards running on port ${PORT}`);
});
