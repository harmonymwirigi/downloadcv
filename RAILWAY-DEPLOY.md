# Railway Deployment Guide

Step-by-step guide to deploy the CV Automation Service to Railway.

## Prerequisites

- GitHub account with the repository: `harmonymwirigi/downloadcv`
- Railway account (sign up at [railway.app](https://railway.app))

## Step 1: Connect GitHub Repository

1. Go to [railway.app](https://railway.app) and sign in
2. Click **"New Project"** (or the **"+"** button)
3. Select **"Deploy from GitHub repo"**
4. Authorize Railway to access your GitHub account (if first time)
5. Select the repository: **`harmonymwirigi/downloadcv`**
6. Railway will automatically detect it's a Node.js project and start building

## Step 2: Configure Environment Variables

1. In your Railway project dashboard, click on your service
2. Go to the **"Variables"** tab
3. Add the following environment variable (optional, already set in Dockerfile):
   - **Key:** `NODE_ENV`
   - **Value:** `production`

**Note:** The Dockerfile already sets `NODE_ENV=production`, but you can override it here if needed.

## Step 3: Wait for Deployment

1. Railway will automatically:
   - Build the Docker image using the `Dockerfile`
   - Install all dependencies
   - Start the server
2. Monitor the build logs in the Railway dashboard
3. Once deployed, Railway will provide you with a public URL like:
   ```
   https://downloadcv-production.up.railway.app
   ```

## Step 4: Test the Deployment

Test that your service is running:

```powershell
# Test health check
Invoke-RestMethod -Uri https://YOUR-RAILWAY-URL.up.railway.app

# Should return: {"status":"CV Automation Service Running"}
```

## Step 5: Configure Airtable Webhook

1. Update your Airtable Automation webhook URL to use your Railway URL
2. See [WEBHOOK-SETUP.md](./WEBHOOK-SETUP.md) for detailed instructions
3. Replace `https://YOUR-RAILWAY-URL.up.railway.app` with your actual Railway URL

## Troubleshooting

### Build Fails

- **Check logs:** Railway dashboard → Service → Logs
- **Common issues:**
  - Dockerfile syntax errors
  - Missing dependencies
  - Node version mismatch

### Service Won't Start

- **Check environment variables:** Ensure `NODE_ENV=production` is set
- **Check port:** Railway automatically sets `PORT` environment variable
- **Check logs:** Look for error messages in Railway logs

### Puppeteer/Chrome Issues

- Puppeteer automatically downloads Chromium during `npm install`
- If Chrome fails to launch, check Railway logs for specific errors
- The Dockerfile includes all necessary Chrome dependencies

### Service is Slow

- Railway free tier has resource limits
- Consider upgrading for better performance
- Check Railway metrics in the dashboard

## Railway Features

- **Automatic HTTPS:** Railway provides SSL certificates automatically
- **Auto-deploy:** Pushes to `main` branch automatically trigger deployments
- **Logs:** View real-time logs in the Railway dashboard
- **Metrics:** Monitor CPU, memory, and network usage

## Updating the Service

1. Make changes to your code
2. Commit and push to GitHub:
   ```bash
   git add .
   git commit -m "Your changes"
   git push origin main
   ```
3. Railway will automatically detect the push and redeploy

## Custom Domain (Optional)

1. In Railway dashboard → Settings → Domains
2. Add your custom domain
3. Railway will provide DNS records to configure

## Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NODE_ENV` | No | `production` | Node environment |
| `PORT` | No | `3000` | Server port (Railway sets this automatically) |
| `PUPPETEER_EXECUTABLE_PATH` | No | (auto) | Chrome executable path (Puppeteer handles this) |

## Support

- Railway Docs: https://docs.railway.app
- Railway Discord: https://discord.gg/railway
- Check service logs in Railway dashboard for debugging

