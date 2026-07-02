# Host Orbit online for FREE 🪐

This guides you from zero to a live site, all on free tiers. No credit card needed
for the basics.

**What we use (all free):**

| Part | Service | What it's for |
| --- | --- | --- |
| Code | **GitHub** | stores your code; the hosts pull from it |
| API + Database | **Render** | runs the backend + a free Postgres |
| Website | **Vercel** | runs the Next.js site |

**Two things to know about free tiers (both are fine for a demo/portfolio):**

- The API **sleeps after ~15 min** of no traffic. The first visit after a nap takes
  ~30–60 seconds to wake up, then it's fast.
- Uploaded photos live on a temporary disk and **reset when the API redeploys**.
  (Optional fix later: point `S3_*` at Cloudflare R2's free tier.)

---

## Step 1 — Put your code on GitHub

Your project is already a git repo with a first commit (I set that up). Now push it:

1. On GitHub, click **New** (top-left) → name it e.g. `orbit` → **Create repository**
   (leave it empty — no README).
2. Copy the commands GitHub shows under **"…or push an existing repository"**, or run:

   ```bash
   git remote add origin https://github.com/<your-username>/orbit.git
   git branch -M main
   git push -u origin main
   ```

   (If it asks you to sign in, use your GitHub login / a browser prompt.)

Refresh the GitHub page — your files should be there. ✅

---

## Step 2 — Deploy the API + database on Render

1. Go to **render.com** → sign up **with GitHub** (one click).
2. Click **New +** → **Blueprint**.
3. Pick your `orbit` repo. Render finds the `render.yaml` file and shows a plan:
   a **Postgres database** + the **orbit-api** service. Click **Apply**.
4. Wait for the build (~3–5 min). When it's done, open the **orbit-api** service and
   copy its URL at the top — it looks like:

   ```
   https://orbit-api.onrender.com
   ```

   Keep this handy — call it your **API URL**.

> The database schema is created automatically on first boot. There's no demo data —
> you'll create your own account by signing up on the site.

---

## Step 3 — Deploy the website on Vercel

1. Go to **vercel.com** → sign up **with GitHub**.
2. **Add New… → Project** → import your `orbit` repo.
3. In the setup screen:
   - **Root Directory** → click **Edit** → choose **`apps/web`**.
   - Framework: it auto-detects **Next.js** (leave the build settings default).
   - Expand **Environment Variables** and add these three (use YOUR API URL from Step 2):

     | Name | Value |
     | --- | --- |
     | `NEXT_PUBLIC_SOCKET_URL` | `https://orbit-api.onrender.com` |
     | `API_PROXY_URL` | `https://orbit-api.onrender.com` |
     | `NEXT_PUBLIC_API_URL` | *(leave blank for now — we set it in Step 4)* |

4. Click **Deploy**. When it finishes, copy your site URL — it looks like:

   ```
   https://orbit-<something>.vercel.app
   ```

   Call this your **Website URL**.

---

## Step 4 — Connect the two (2 quick edits)

Now that both have URLs, point them at each other.

**A) On Vercel** → your project → **Settings → Environment Variables**:
- Set **`NEXT_PUBLIC_API_URL`** = your **Website URL** (yes, the Vercel one — this
  makes the site call its own `/api`, which is proxied to Render so login stays
  logged in).
- Then go to **Deployments → ⋯ → Redeploy** (so the new value takes effect).

**B) On Render** → **orbit-api** → **Environment**, set these to your **Website URL**:

| Name | Value |
| --- | --- |
| `WEB_URL` | `https://orbit-<something>.vercel.app` |
| `CORS_ORIGINS` | `https://orbit-<something>.vercel.app` |
| `API_URL` | `https://orbit-api.onrender.com` |

Render redeploys automatically after you save.

---

## Step 5 — You're live! 🎉

Open your **Website URL**, click **Sign up**, and create your account.
(First load may take ~30–60s if the API was asleep.)

---

## Troubleshooting

- **"Can't reach the server" on first load** → the API was asleep; wait a minute and retry.
- **Login doesn't stay after refresh** → double-check Step 4A: `NEXT_PUBLIC_API_URL`
  must be your **Vercel** site URL and `API_PROXY_URL` must be the **Render** API URL,
  then Redeploy on Vercel.
- **CORS / "not allowed" errors** → `CORS_ORIGINS` on Render must exactly match your
  Vercel URL (no trailing slash).
- **Vercel build fails** → make sure **Root Directory** is `apps/web`.
- **Photos disappeared** → expected on free (temporary disk). Set `S3_*` on Render
  (Cloudflare R2 free tier) for permanent storage.

## Optional upgrades later
- **Permanent database** (no 90-day limit): create a free DB at **neon.tech**, copy its
  connection string, and set it as `DATABASE_URL` on the Render service.
- **Permanent image storage**: Cloudflare R2 (free 10 GB) — set `S3_ENDPOINT`,
  `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET` on Render.
- **Real emails**: set `SMTP_HOST/PORT/USER/PASSWORD` + `EMAIL_FROM` on Render.
- **Custom domain**: add it in Vercel (free) and update `WEB_URL`/`CORS_ORIGINS` on Render.
