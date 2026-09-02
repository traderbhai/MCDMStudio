# Deploying MCDM Studio

MCDM Studio is a static, browser-only React/Vite application. All calculations and file processing run in the user's browser. The production deployment does not require a backend, database, login system, or cloud storage.

## Build

From the project root:

```powershell
npm run verify
```

This runs TypeScript checks, numerical method checks, workflow checks, external validation fixture checks, documentation checks, and the production build.

The deployable output is:

```text
dist/
```

Upload the contents of `dist/` to your web server.

## Shared Hosting Or cPanel

1. Run `npm run verify`.
2. Open your hosting file manager.
3. Go to `public_html`.
4. Upload the contents of `dist/`.
5. Keep the generated `.htaccess` file in place.

The `.htaccess` file is included automatically from `public/.htaccess` so browser refreshes and direct links fall back to `index.html`.

## Apache

Use the generated `.htaccess` file from the build output. If your host does not allow `.htaccess`, add the same rewrite rules to the Apache virtual host configuration:

```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>
```

## Nginx

Point the site root to the built `dist` directory and use an SPA fallback:

```nginx
server {
  listen 80;
  server_name example.com;
  root /var/www/mcdm-studio;
  index index.html;

  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

## Netlify Or Similar Static Hosts

Upload or connect the repository and use:

```text
Build command: npm run verify
Publish directory: dist
```

The generated `_redirects` file provides the `/* /index.html 200` fallback.

## Hosting In A Subfolder

For a root domain, no special setting is needed:

```powershell
npm run verify
```

For a subfolder such as `https://example.com/mcdm/`, build with:

```powershell
$env:VITE_BASE_PATH='/mcdm/'; npm run verify
```

Then upload the contents of `dist/` into the matching server folder.

## Privacy And Server Load

Uploaded Excel files are processed in the browser. They are not sent to the web server by this app. The server only serves static HTML, CSS, JavaScript, and asset files.

## Post-Deployment Smoke Test

After uploading, test:

- The home screen loads without a blank page.
- Method selection opens the configure step.
- Automatic weighting hides manual weight cells.
- Template download works.
- Uploading a valid template reaches results.
- Excel, DOCX, PDF, project JSON, and full package exports download.
