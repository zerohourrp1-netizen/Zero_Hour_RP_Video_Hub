# Zero Hour RP Video Hub — GitHub Pages Fixed Package

This version places the critical website files directly in the repository root so the design loads correctly on GitHub Pages.

Upload ALL of these files to the main repository page:

- index.html
- watch.html
- dashboard.html
- style.css
- app.js
- admin.js
- config.js
- zero-hour-logo.png
- 404.html
- README.md
- supabase folder

The `assets` folder is included as a backup, but the website now uses the root files.

## Important GitHub steps

1. Delete the old website files from the repository.
2. Extract this ZIP on your computer.
3. Open the extracted folder.
4. Select everything inside it.
5. Drag everything into the main GitHub repository upload screen.
6. Commit the upload.
7. Go to Settings > Pages.
8. Select `main` and `/(root)`.
9. Wait a few minutes.
10. Open the website in a private/incognito window to avoid the old cached page.

## Supabase

The website design will load without Supabase, but global videos require it.

Open `config.js` and enter your:
- Supabase Project URL
- Supabase anon/public key

Then run `supabase/schema.sql` in the Supabase SQL Editor.
