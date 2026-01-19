const http = require('http');

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/',
  method: 'GET'
};

const req = http.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  console.log(`Headers:`, res.headers);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log(`Response length: ${data.length} bytes`);
    if (res.statusCode === 200) {
      console.log('✓ Root route working!');
      console.log('First 200 chars:', data.substring(0, 200));
    } else {
      console.log('✗ Error:', data);
    }
  });
});

req.on('error', (e) => {
  console.error(`Request error: ${e.message}`);
});

req.end();

setTimeout(() => process.exit(0), 2000);
