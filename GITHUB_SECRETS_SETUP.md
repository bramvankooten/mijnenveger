# Using GitHub Secrets for Supabase Configuration

This guide explains how to securely manage your Supabase credentials using GitHub Secrets.

## Why Use GitHub Secrets?

- **Security**: Keep sensitive credentials out of your repository
- **Best Practice**: Industry-standard approach for secret management
- **CI/CD Integration**: Automatically inject secrets during deployment
- **Rotation**: Update secrets without changing code

## Setup Instructions

### Step 1: Add Secrets to Your GitHub Repository

1. Navigate to your GitHub repository
2. Go to **Settings** (top right)
3. In the left sidebar, click **Secrets and variables** → **Actions**
4. Click the **New repository secret** button
5. Add the following secrets:

#### Secret 1: SUPABASE_URL
- **Name**: `SUPABASE_URL`
- **Value**: Your Supabase project URL (e.g., `https://btffggcdbovkzhhtafhg.supabase.co`)
- Click **Add secret**

#### Secret 2: SUPABASE_ANON_KEY
- **Name**: `SUPABASE_ANON_KEY`
- **Value**: Your Supabase anonymous key (the full key from your project settings)
- Click **Add secret**

### Step 2: Configure Your Application

Your `config.js` is already set up to read from environment variables:

```javascript
const SUPABASE_CONFIG = {
    url: process.env.SUPABASE_URL || 'fallback-url',
    anonKey: process.env.SUPABASE_ANON_KEY || 'fallback-key'
};
```

## How Secrets Work

### Local Development
When developing locally, the fallback values in `config.js` are used since environment variables aren't set.

### CI/CD Deployment (GitHub Actions)
When deploying via GitHub Actions, create a workflow file `.github/workflows/deploy.yml`:

```yaml
name: Deploy Minesweeper

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Use Secrets
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
        run: |
          # Your deployment commands here
          echo "Deploying with Supabase URL: $SUPABASE_URL"
```

### Hosting Platforms (Vercel, Netlify, etc.)

#### Vercel
1. Go to your project settings
2. Click **Environment Variables**
3. Add:
   - `SUPABASE_URL`: Your Supabase URL
   - `SUPABASE_ANON_KEY`: Your Supabase Anon Key
4. Select which environments (Production, Preview, Development)
5. Redeploy

#### Netlify
1. Go to your site settings
2. Click **Build & deploy** → **Environment**
3. Add environment variables:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
4. Redeploy

#### GitHub Pages (Static Site)
For static hosting on GitHub Pages, you'll need a build step. Create `.github/workflows/build-deploy.yml`:

```yaml
name: Build and Deploy

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    
    env:
      SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
      SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Create config
        run: |
          echo "const SUPABASE_CONFIG = {
            url: '${{ secrets.SUPABASE_URL }}',
            anonKey: '${{ secrets.SUPABASE_ANON_KEY }}'
          };" > config.js
      
      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: .
```

## Important Security Notes

### Never Commit Real Credentials
⚠️ **IMPORTANT**: Never commit real API keys to your repository, even if it's private.

If you've already committed credentials:
1. Rotate your Supabase keys immediately
2. Use `git rm --cached config.js` (if you want to keep it locally)
3. Add `config.js` to `.gitignore`
4. Force push the changes

### Accessing Secrets in Client Code
The Supabase Anon Key is **intentionally public** - it's designed to be embedded in client-side applications. However:
- Use Row Level Security (RLS) policies in Supabase to restrict access
- The Anon Key only has public read/write permissions you define
- **Never** expose your Service Role Key in client code

### Credential Rotation
Periodically rotate your credentials:
1. Go to your Supabase project settings
2. Regenerate the Anon Key
3. Update the secret in GitHub:
   - Settings → Secrets → Click the secret
   - Click **Update**
   - Paste the new key
   - Confirm

## Troubleshooting

### Environment Variables Not Loading
- For local development, create a `.env.local` file:
  ```
  SUPABASE_URL=https://...
  SUPABASE_ANON_KEY=eyJ...
  ```
- Build tools (Vite, Create React App) will automatically load these

### Secrets Not Available in Workflow
- Secrets are only available to workflows triggered by:
  - Push to main/protected branches
  - Pull requests from the same repository
  - Repository dispatch events
- They're not available for pull requests from forks (security measure)

### Testing Locally
Create `.env.local` (never commit this):
```
SUPABASE_URL=https://your-url.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
```

Then access with:
```javascript
const url = process.env.SUPABASE_URL || 'fallback';
```

## Best Practices

✅ **DO:**
- Use GitHub Secrets for sensitive credentials
- Rotate credentials regularly
- Use Row Level Security in Supabase
- Add `config.js` with real credentials to `.gitignore`
- Keep fallback values as generic examples

❌ **DON'T:**
- Commit real credentials to the repository
- Share secrets in commits, PRs, or issues
- Use the same keys across multiple environments
- Log secrets in CI/CD output
- Hardcode credentials in production code

## Additional Resources

- [GitHub Secrets Documentation](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [Supabase Security Best Practices](https://supabase.com/docs/guides/self-hosting/security)
- [Environment Variables in Vercel](https://vercel.com/docs/projects/environment-variables)
- [Netlify Build Environment Variables](https://docs.netlify.com/configure-builds/environment-variables/)
