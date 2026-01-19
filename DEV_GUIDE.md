# GSAMS Development Guide

## Quick Start

### Development Mode (Auto-restart on changes)
```bash
npm run dev
```

This starts the server with **nodemon** which automatically restarts when you modify:
- `index.js` (backend code)
- Files in `public/` (frontend files)
- `.env` (environment variables)

### Production Mode
```bash
npm start
```

Standard node server without auto-restart.

---

## Nodemon Features

### Automatic Restart
The server automatically restarts when you save changes to:
- ✅ JavaScript files (`.js`)
- ✅ JSON files (`.json`)
- ✅ HTML files (`.html`)
- ✅ CSS files (`.css`)

### Manual Restart
Type `rs` in the terminal and press Enter to manually restart the server.

### Stop Server
Press `Ctrl + C` to stop the server.

---

## Development Workflow

1. **Start development server:**
   ```bash
   npm run dev
   ```

2. **Make your changes** to any file

3. **Server auto-restarts** - watch the terminal for:
   ```
   [nodemon] restarting due to changes...
   [nodemon] starting `node index.js`
   GSAMS Backend running on port 5000
   ```

4. **Refresh browser** to see changes (for frontend files)

---

## Accessing the Application

- **Admin Dashboard:** http://localhost:5000/
- **Attendance Form:** http://localhost:5000/attend.html?code=MEETINGCODE
- **API Health Check:** http://localhost:5000/api/health
- **API Base URL:** http://localhost:5000/api

---

## MongoDB Connection

The server maintains a persistent connection to MongoDB with:
- ✅ Auto-reconnect on disconnection
- ✅ Connection timeout handling
- ✅ Error logging

If MongoDB disconnects, you'll see:
```
MongoDB disconnected. Attempting to reconnect...
```

Mongoose will automatically try to reconnect.

---

## Environment Variables

Create a `.env` file in the root directory:

```env
PORT=5000
BASE_URL=http://localhost:5000
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database
JWT_SECRET=your-super-secret-key-change-this
NODE_ENV=development

# Optional
TWILIO_ACCOUNT_SID=your-twilio-sid
TWILIO_AUTH_TOKEN=your-twilio-token
TWILIO_PHONE_NUMBER=your-twilio-phone
```

---

## Common Issues

### Port Already in Use
If you see `EADDRINUSE` error:
```bash
# Find and kill the process using port 5000
lsof -ti:5000 | xargs kill -9
```

### Server Not Restarting
1. Check nodemon is installed: `npm list nodemon`
2. Try manual restart: Type `rs` and press Enter
3. Check file is being watched: Look at `nodemon.json`

### MongoDB Connection Issues
1. Check your MongoDB URI in `.env`
2. Ensure your IP is whitelisted in MongoDB Atlas
3. Check network connectivity

---

## File Structure

```
gsb/
├── index.js              # Main backend server
├── package.json          # Dependencies and scripts
├── nodemon.json          # Nodemon configuration
├── .env                  # Environment variables (create this)
├── public/               # Frontend files
│   ├── index.html       # Admin dashboard
│   └── attend.html      # Public attendance form
└── node_modules/         # Dependencies (auto-generated)
```

---

## Tips

1. **Keep terminal visible** to see restart notifications
2. **Use `console.log()`** for debugging - output appears in terminal
3. **Check logs** when something doesn't work
4. **MongoDB stays connected** - no need to restart for DB changes
5. **Frontend changes** require browser refresh (no hot reload)

---

## Deployment

For production deployment:

1. Set environment variables on your hosting platform
2. Use `npm start` (not `npm run dev`)
3. Set `NODE_ENV=production`
4. Set proper `BASE_URL` for your domain

---

## Support

- Check server logs in terminal
- Visit `/api/health` to verify server is running
- Check MongoDB connection status in startup logs
