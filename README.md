# Parental Preferences - Multi-User App

A kid-friendly web application for tracking which activities Mom and Dad love to do together! Now with multi-user support, Google authentication, and personalized Google Sheets integration.

## Features

### For Users
- 🔐 **Secure Google Sign-In** - No passwords to manage
- 📊 **Personal Google Sheet** - Connect your own preferences sheet
- 🎨 **Custom Themes** - Pick your favorite colors and fonts
- 🖨️ **Print-Ready** - Beautiful layouts for 8.5×11" paper
- 👨👩 **Parent Emojis** - Visual indicators for Mom, Dad, or both
- ⭐ **Independence Tracking** - Activities kids can do on their own

### For Admins
- 👥 **User Management** - View and manage all registered users
- 📈 **Statistics** - Track total users and connected sheets
- 🛡️ **Access Control** - Enable/disable user accounts

## Tech Stack

- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Authentication**: Supabase Auth with Google OAuth
- **Database**: Supabase (PostgreSQL)
- **Backend**: Netlify Functions (serverless)
- **Hosting**: Netlify
- **Data Source**: Google Sheets (user-specific)

## Quick Start

### For End Users

1. Visit the app URL
2. Click "Sign in with Google"
3. Go to Dashboard
4. Enter your Google Sheet ID
5. Customize your theme
6. View your activities!

### For Developers

See [`DEPLOYMENT.md`](DEPLOYMENT.md) for complete setup instructions.

**Quick setup:**
```bash
# Clone the repo
git clone https://github.com/josuhr/parental-preferences-webapp.git
cd parental-preferences-webapp

# Install function dependencies
cd netlify/functions
npm install
cd ../..

# Set up Supabase (see DEPLOYMENT.md)
# Set up Netlify environment variables
# Deploy!
```

## Project Structure

```
parental-preferences/
├── index.html              # Main activity viewer (auth required)
├── auth.html               # Login/signup page
├── dashboard.html          # User settings and sheet configuration
├── admin.html              # Admin panel (admin role required)
├── script.js               # Main app logic
├── auth.js                 # Authentication logic
├── dashboard.js            # Dashboard logic
├── admin.js                # Admin panel logic
├── supabase-config.js      # Supabase client configuration
├── styles.css              # Styles with CSS variables for theming
├── netlify.toml            # Netlify configuration
├── database-schema.sql     # Supabase database schema
├── DEPLOYMENT.md           # Detailed deployment guide
├── SUPABASE_SETUP.md       # Supabase setup instructions
└── netlify/
    └── functions/
        ├── get-config.js   # Returns Supabase config to frontend
        └── package.json    # Function dependencies
```

## Database Schema

### Users Table
- Stores user profiles, emails, Google IDs
- Tracks which Google Sheet each user has configured
- Manages admin vs regular user roles
- Records last login times

### User Settings Table
- Theme color preferences
- Font family choices
- Custom category tab names
- Auto-created for each new user

## Google Sheet Format

Each user's Google Sheet should have these tabs:
- Arts & Crafts
- Experiential
- Games
- Movies
- Music
- Reading & Ed
- Video Games

**Column Structure (per tab):**
- Column A: Parent emoji (👨, 👩, 👨👩, or empty)
- Column B: Activity name
- Column C: Preference level (Drop Anything, Sometimes, On Your Own)

## Environment Variables (Netlify)

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## Features Roadmap

- [x] Google OAuth authentication
- [x] User dashboard
- [x] Admin panel
- [x] Theme customization
- [x] User-specific Google Sheets
- [ ] Email notifications for new users
- [ ] Activity suggestions
- [ ] Share read-only links with family
- [ ] Mobile app version
- [ ] Dark mode
- [ ] Multiple language support

## Contributing

This is a personal/family project, but suggestions are welcome! Open an issue or submit a pull request.

## License

MIT License - feel free to use and modify for your own family!

## Support

For issues or questions:
1. Check [`DEPLOYMENT.md`](DEPLOYMENT.md) for setup help
2. Review browser console for errors
3. Verify Supabase and Netlify configurations
4. Open a GitHub issue

---

Made with 💜 for helping families spend quality time together!
