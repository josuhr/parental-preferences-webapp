#!/bin/bash

# Simple HTTP Server Launcher for Parental Preferences App
# This starts a local web server so the app can access Google Sheets

echo "🚀 Starting local web server..."
echo ""
echo "📂 Serving from: $(pwd)"
echo ""

# Check if Python 3 is available
if command -v python3 &> /dev/null; then
    echo "✅ Using Python 3"
    echo ""
    echo "🌐 Open your browser and go to:"
    echo "   http://localhost:8000"
    echo ""
    echo "Press Ctrl+C to stop the server"
    echo ""
    python3 -m http.server 8000
# Check if Python 2 is available
elif command -v python &> /dev/null; then
    echo "✅ Using Python 2"
    echo ""
    echo "🌐 Open your browser and go to:"
    echo "   http://localhost:8000"
    echo ""
    echo "Press Ctrl+C to stop the server"
    echo ""
    python -m SimpleHTTPServer 8000
else
    echo "❌ Python not found. Please install Python or use Chrome/Firefox instead."
    echo ""
    echo "Alternative: Open index.html with Chrome or Firefox"
    exit 1
fi
