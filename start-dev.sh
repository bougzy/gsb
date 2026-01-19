#!/bin/bash

echo "🚀 Starting GSAMS Development Server..."
echo ""
echo "📝 Features:"
echo "  ✅ Auto-restart on file changes"
echo "  ✅ MongoDB connection monitoring"
echo "  ✅ Hot reload enabled"
echo ""
echo "🌐 Access points:"
echo "  Admin Dashboard: http://localhost:5000/"
echo "  Attendance Form: http://localhost:5000/attend.html?code=CODE"
echo "  API Health:      http://localhost:5000/api/health"
echo ""
echo "💡 Tips:"
echo "  - Type 'rs' and press Enter to manually restart"
echo "  - Press Ctrl+C to stop the server"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

npm run dev
