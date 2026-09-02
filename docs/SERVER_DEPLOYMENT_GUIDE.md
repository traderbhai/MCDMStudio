# MCDM Studio Server Deployment Guide

MCDM Studio is a static browser app. No backend, database, login system, or server-side file storage is required. Excel, DOCX, PDF, fuzzy calculations, group aggregation, and exports run inside the user's browser.

## Build

From the project folder:

```bash
cd D:\MCDM
npm install
npm run verify
npm run build
```

The deployable website is created in:

```text
D:\MCDM\dist
```

## Upload To A Web Server

Upload the contents of `dist/` to your website public folder, for example `public_html`.

Upload:

```text
dist/index.html
dist/assets/
```

Do not upload these folders to the public website folder:

```text
node_modules/
src/
scripts/
docs/
.tmp-*/
qa-artifacts/
```

They are source, dependency, or QA files. They are useful in GitHub, but not needed for visitors using the website.

## cPanel / Shared Hosting

1. Open cPanel File Manager.
2. Go to `public_html` or the domain document root.
3. Upload everything inside `D:\MCDM\dist`.
4. Confirm `index.html` is directly inside the public folder.
5. Open your domain.

If routing needs help on Apache hosting, use the included `public/.htaccess` before building so it is copied into `dist/`.

## Netlify

1. Run `npm run build`.
2. Drag the `dist/` folder into Netlify.
3. Netlify will host the static app.

The included `public/_redirects` supports single-page app routing.

## Vercel

Import the GitHub repository and use:

```text
Framework: Vite
Build command: npm run build
Output directory: dist
```


## Subfolder Hosting

The included shared-hosting package is built with relative asset paths, so it works from a subfolder such as:

```text
https://mohdnaved.com/MCDMStudio/
```

If you see a blank page after upload, check the browser network tab. Asset files should load from `/MCDMStudio/assets/...`, not `/assets/...`.

## Test After Upload

Check these flows on the live URL:

1. First screen shows `MCDM Studio`.
2. Help page opens.
3. A method can be selected.
4. A method-specific template can be downloaded.
5. A filled Excel file can be uploaded.
6. Results and exports appear.

## Continue Development On Another Computer

```bash
git clone https://github.com/traderbhai/MCDMStudio.git
cd MCDMStudio
npm install
npm run verify
npm run preview
```

Then open:

```text
http://127.0.0.1:4173/
```

## QA Artifacts

Generated QA evidence is stored in:

```text
qa-artifacts/demo-upload-smoke/
```

It includes:

- `demo-workbooks/`: realistic generated upload workbooks for all methods.
- `analysis-exports/`: generated analysis exports from the upload smoke test.
- `demo-upload-summary.json`: method-by-method upload, validation, analysis, and output summary.

These artifacts are for review and evidence. They are not required to run the website.

## Accuracy Boundary

Automated checks prove that workflows, uploads, reports, exports, and calculations execute correctly for covered cases. Publication-grade numerical certification should be claimed only for method variants with passing traceable external validation fixtures.
