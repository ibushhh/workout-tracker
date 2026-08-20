# Deploying to Railway

One shared Postgres database and one Express API, serving the built client
from the same origin — no separate frontend host, no CORS configuration.

## 1. Push this project to GitHub

```bash
git init
git add server app docs .gitignore
git commit -m "Initial commit"
```

Create a repo on GitHub (private recommended) and push.

## 2. Create the Railway project

1. [railway.app](https://railway.app) → **New Project → Deploy from GitHub repo** → this repo.
2. Set the service's **Root Directory** to `server` (Settings → Source → Root Directory) — that's where `package.json` lives.
3. **New → Database → Add PostgreSQL** in the same project. Railway auto-creates `DATABASE_URL`.

## 3. Set environment variables

On the **server** service → Variables:

| Variable | Value |
|---|---|
| `JWT_SECRET` | generate one: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `DATABASE_URL` | reference the Postgres service's `DATABASE_URL` (pick from the variable-reference dropdown) |
| `PGSSL` | `true` |
| `CORS_ORIGIN` | leave unset (client and API share one origin once deployed) |

`PORT` is set automatically by Railway.

## 4. Build the client into the server, then push

```bash
cd app
npm run build
npm run deploy      # copies dist/index.html to ../server/public/index.html
cd ..
git add server/public
git commit -m "Update client build"
git push
```

Repeat this whenever `app/src` changes — Railway redeploys automatically on push.

## 5. Apply the schema and seed starter data

Once the server has deployed, run these **once** against the production database (safe to re-run):

```bash
npm install -g @railway/cli
railway login
railway link       # from the server/ folder, link to this project
railway run npm run migrate
railway run npm run seed
```

`migrate` creates the tables; `seed` loads the default cardio activities and
starter exercise library that every account sees.

## 6. Create your account

Visit the deployed URL and register — no separate admin bootstrap step is
needed, registration is open (add auth restrictions later if this becomes
a shared/public deployment rather than a personal one).
