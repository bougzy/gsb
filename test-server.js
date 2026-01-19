// Simple test to verify server setup
const express = require('express');
const path = require('path');

const app = express();
const PORT = 3001;

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Test API route
app.get('/api/test', (req, res) => {
  res.json({ success: true, message: 'API working' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Test server running on http://localhost:${PORT}`);
  console.log(`Try: http://localhost:${PORT}/attend.html?code=TEST`);
  console.log(`API: http://localhost:${PORT}/api/test`);
});
