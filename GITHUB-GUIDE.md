# Put your website on GitHub Pages

You need a free GitHub account (https://github.com). Your site will live at `https://YOUR-USERNAME.github.io`.

## Before you start: your old al-folio site

If `YOUR-USERNAME.github.io` already holds your al-folio site, this new site will replace it. To keep a copy of the old one:

1. Open your repository on GitHub, click the branch menu (it says `main` or `master`), type `al-folio-backup` and choose **Create branch**. The old site now stays safe in that branch.

## Path A: browser only (no installs)

1. Unzip `portfolio-site.zip` on your computer. You get a folder `portfolio-site`.
2. On GitHub click **+ > New repository**. Name it exactly `YOUR-USERNAME.github.io`, choose **Public**, click **Create repository**. (If the repository already exists, open it instead.)
3. On the repository page click **Add file > Upload files**. Open the unzipped `portfolio-site` folder and drag in everything inside it (the files `index.html`, `news.html`, `publications.html` and the folders `css`, `js`, `projects`, `assets`, and the rest), not the folder itself.
4. Click **Commit changes**.
5. Create the hidden file `.nojekyll`: **Add file > Create new file**, type `.nojekyll` as the name, click **Commit changes**. (Some computers hide it when you drag files, so create it here.)
6. Go to **Settings > Pages**. Under **Build and deployment**, set **Source** to **Deploy from a branch**, branch **main**, folder **/ (root)**, and click **Save**.
7. Wait one or two minutes, then open `https://YOUR-USERNAME.github.io`. (A green check under the repository's **Actions** tab means it is deployed.)

If the repository still holds old al-folio files, delete them first: open each old file or folder, click the three dots, **Delete**, and commit. Or use Path B, which is faster for this.

## Path B: replacing al-folio with git (faster for a repository that already has files)

Run these in a terminal (Terminal on Mac, Git Bash on Windows). You need git installed (https://git-scm.com).

```
git clone https://github.com/YOUR-USERNAME/YOUR-USERNAME.github.io.git
cd YOUR-USERNAME.github.io
git checkout -b al-folio-backup
git push origin al-folio-backup
git checkout main            # use "master" if your branch is called master
```

Now remove the old files but keep the `.git` folder:

```
find . -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +      # Mac and Linux, Git Bash
```

Copy everything from the unzipped `portfolio-site` folder into this folder (including the hidden `.nojekyll`), then:

```
git add -A
git commit -m "New portfolio website"
git push origin main
```

Then do step 6 above (Settings > Pages > main, / root). If your old site was served from a branch called `gh-pages`, choose `main` there instead, and the old GitHub Action for al-folio can stay off because its files are gone.

## After it is live

1. Open `js/content.js` and set `url: "https://YOUR-USERNAME.github.io"` (near the top). This makes the preview picture and title show when someone shares a link (WhatsApp, LinkedIn, email).
2. Regenerate the page tags. If you have Node.js: run `npm run meta` in the site folder. If you do not, send me the address and I will do it for you.
3. Upload the changed files again (Path A: **Add file > Upload files** with the same names replaces them; Path B: `git add -A`, `git commit`, `git push`).
4. Check on your phone: the colour theme, the Publications page, the News section, and a project page.

## Updating later

- News: edit `js/news.js` (copy a line, newest first).
- A new paper: add an entry to `js/publications.js`.
- Text, skills, projects: `js/content.js`. Change `updated` there when you edit the site.
- Commit again and the site refreshes in a minute or two.
