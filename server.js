const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use('/mediation-pipeline', express.static(path.join(__dirname, 'public', 'mediation-pipeline')));
app.use('/motion-dashboard', express.static(path.join(__dirname, 'public', 'motion-dashboard')));
app.use('/discovery-tracker', express.static(path.join(__dirname, 'public', 'discovery-tracker')));

app.get('/', (req, res) => {
      res.send(`
          <!DOCTYPE html>
              <html lang="en">
                  <head>
                        <meta charset="UTF-8">
                              <meta name="viewport" content="width=device-width, initial-scale=1.0">
                                    <title>Blackstone Law Dashboards</title>
                                          <style>
                                                  body { font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 80px auto; padding: 0 20px; color: #1a1a1a; }
                                                          h1 { font-size: 1.5rem; margin-bottom: 2rem; }
                                                                  a { display: block; padding: 12px 16px; margin-bottom: 8px; background: #f5f5f5; border-radius: 6px; color: #1a1a1a; text-decoration: none; font-weight: 500; }
                                                                          a:hover { background: #e8e8e8; }
                                                                                </style>
                                                                                    </head>
                                                                                        <body>
                                                                                              <h1>Blackstone Law Dashboards</h1>
                                                                                                    <a href="/mediation-pipeline">Mediation Pipeline Dashboard</a>
                                                                                                          <a href="/motion-dashboard">Motion Dashboard</a>
                                                                                                                <a href="/discovery-tracker">Discovery Tracker</a>
                                                                                                                    </body>
                                                                                                                        </html>
                                                                                                                          `);
});

app.use((req, res) => {
      res.redirect('/');
});

app.listen(PORT, () => {
      console.log(`Blackstone dashboards running on port ${PORT}`);
});
