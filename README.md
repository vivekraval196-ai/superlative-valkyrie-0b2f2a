# AutoCost

A responsive auto-loan EMI and total-ownership-cost dashboard built with Next.js, PostgreSQL, Drizzle ORM, and Chart.js.

## Included

- Live EMI, interest, and full ownership estimates
- Monthly and yearly donut-chart breakdowns
- Editable vehicle scenarios with saved-plan search, update, and delete flows
- Private demo workspaces that are seeded on a visitor’s first visit
- Email/password account creation, sign-in, sign-out, and guest-workspace claiming
- Responsive leaderboard and sidebar ad placements, plus affiliate-link placeholders
- SEO metadata, loading states, empty states, optimistic scenario updates, and accessible form controls

## Local development

1. Install dependencies with `npm install`.
2. Start the app with `netlify dev`, which connects to the site's Netlify Database automatically.

The app uses Netlify Database (managed Postgres). The schema lives in `src/db/schema.ts`; after changing it, run `npx drizzle-kit generate --name <change_name>` to create a migration in `netlify/database/migrations/`. Netlify applies migrations automatically on deploy.

The first dashboard request creates a private guest workspace and seeds three sample vehicles. Visitors can use the calculator immediately or create an account to keep the workspace and saved scenarios associated with their account.

## Deploying

This is a full-stack Next.js application, not a static HTML export. Deploy it to Netlify: the database is provisioned automatically and pending migrations are applied before each deploy is published, so no connection string needs to be configured. The ad and partner buttons are integration placeholders; connect your own ad tags and tracked partner URLs before monetizing.

GitHub Pages only serves static files and cannot run the Next.js API routes, secure authentication, or PostgreSQL persistence used here. A GitHub Pages-only version would require replacing those features with a separate hosted backend, or reducing the app to a non-persistent static calculator.
