# Resend Email Setup Guide

## Why Resend?

Resend is a modern email API built for developers with:
- ✅ **100 emails/day free** (3,000/month)
- ✅ **Simple, clean API**
- ✅ **Great documentation**
- ✅ **Quick setup** (5 minutes)
- ✅ **No credit card required** for free tier

## Setup Steps

### 1. Create Resend Account

1. Go to [resend.com](https://resend.com)
2. Sign up with your email or GitHub
3. Verify your email

### 2. Get Your API Key

1. Go to [resend.com/api-keys](https://resend.com/api-keys)
2. Click **"Create API Key"**
3. Name it: `Carer Support Platform`
4. Permission: **Sending access**
5. Copy the API key (starts with `re_`)

### 3. Configure Netlify Environment Variables

**Option A: Via Netlify Dashboard (Recommended)**

1. Go to your Netlify dashboard
2. Select your site: **carer-support**
3. Go to **Site settings** → **Environment variables**
4. Click **Add a variable**
5. Add these variables:

```
RESEND_API_KEY=re_your_api_key_here
RESEND_FROM_EMAIL=Carer Support <noreply@yourdomain.com>
```

**Option B: Via Netlify CLI**

```bash
netlify env:set RESEND_API_KEY "re_your_api_key_here"
netlify env:set RESEND_FROM_EMAIL "Carer Support <noreply@yourdomain.com>"
```

### 4. Verify Domain (Optional but Recommended)

**Without domain verification:**
- Can only send from `onboarding@resend.dev`
- Works fine for testing

**With domain verification:**
- Send from your own domain (e.g., `noreply@carer-support.com`)
- Better deliverability
- More professional

**To verify domain:**
1. Go to [resend.com/domains](https://resend.com/domains)
2. Click **"Add Domain"**
3. Enter your domain
4. Add DNS records to your domain provider
5. Wait for verification (usually < 5 minutes)

### 5. Install Dependencies

The package.json already includes Resend. When Netlify deploys, it will auto-install:

```json
{
  "dependencies": {
    "resend": "^3.2.0"
  }
}
```

### 6. Deploy

```bash
git push origin main
```

Netlify will automatically:
- Install the Resend package
- Deploy the updated function
- Use your environment variables

## Testing

### Test Email Sending

1. **Go to Kid Preferences**
2. Click **"Teachers"** on a kid
3. Enter a **new email address** (not in system)
4. Click **"Grant Access"**
5. Check your email for the invitation

### Test Without API Key (Development Mode)

If `RESEND_API_KEY` is not set, the function will:
- Log the invitation details
- Return the invite URL
- You can manually share the URL

This is perfect for testing the flow without email.

## Email Template

The invitation email includes:
- Beautiful gradient header
- Inviter's name
- Kid's name
- Access level badge
- Large "Accept Invitation" button
- 7-day expiration notice
- Fallback plain text link

## Troubleshooting

### Email Not Sending?

1. **Check Netlify Function Logs:**
   - Netlify Dashboard → Functions → `send-invitation`
   - Look for errors

2. **Verify Environment Variables:**
   ```bash
   netlify env:list
   ```

3. **Check Resend Dashboard:**
   - Go to [resend.com/emails](https://resend.com/emails)
   - See all sent emails and their status

4. **Common Issues:**
   - API key not set → Function returns URL for manual sharing
   - Domain not verified → Use `onboarding@resend.dev`
   - Rate limit hit → Free tier: 100/day

### Emails Going to Spam?

1. **Verify your domain** (see step 4 above)
2. **Add SPF/DKIM records** (Resend provides these)
3. **Use a proper "from" address** (not gmail.com)

## Monitoring

### Check Email Status

```javascript
// In Resend dashboard
// View all emails sent
// See delivery status
// View bounce/complaint rates
```

### Logs

Netlify function logs all email sends:
```
Email sent successfully via Resend: {id: 'xxx', from: 'xxx', to: 'xxx'}
```

## Resend Free Tier Limits

| Feature | Free Tier |
|---------|-----------|
| Emails/day | 100 |
| Emails/month | 3,000 |
| Team members | 1 |
| Domains | 1 |
| API keys | Unlimited |
| Email logs | 30 days |

## Alternative: Testing Locally

To test locally with Netlify Dev:

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Set environment variables in .env
echo "RESEND_API_KEY=re_your_key" > .env
echo "RESEND_FROM_EMAIL=noreply@resend.dev" >> .env

# Run locally
netlify dev

# Test the function
curl -X POST http://localhost:8888/.netlify/functions/send-invitation \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","token":"abc123","kidName":"Emma","inviterName":"Sarah","accessLevel":"view"}'
```

## Production Checklist

- [ ] Resend account created
- [ ] API key generated
- [ ] Environment variables set in Netlify
- [ ] Code deployed to Netlify
- [ ] Test invitation sent successfully
- [ ] Email received in inbox (not spam)
- [ ] (Optional) Domain verified
- [ ] (Optional) Custom from address configured

## Need Help?

- **Resend Docs:** [resend.com/docs](https://resend.com/docs)
- **Resend Support:** [resend.com/support](https://resend.com/support)
- **Status Page:** [status.resend.com](https://status.resend.com)

---

**Estimated Setup Time:** 5-10 minutes  
**Cost:** Free (up to 3,000 emails/month)  
**Difficulty:** Easy ⭐
