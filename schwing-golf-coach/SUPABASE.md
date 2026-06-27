# Supabase Player Codes

Use this for v2 cloud profiles. Each player gets a code such as `SEAN` or `TOM`, and Schwing saves that player's profile, club distances, and notes in Supabase.

## 1. Create Supabase Project

1. Go to Supabase.
2. Create a new project.
3. Open the project dashboard.
4. Go to SQL Editor.
5. Paste the contents of `supabase-schema.sql`.
6. Run the SQL.

## 2. Copy Supabase Values

In Supabase, go to Project Settings > API.

Copy:

- Project URL
- service_role key

Use the `service_role` key only on Render. Do not put it in GitHub or browser code.

## 3. Add Render Environment Variables

In Render, open the Schwing web service and add:

```text
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
SUPABASE_PLAYERS_TABLE=schwing_players
```

Then redeploy.

## 4. Use Player Codes

On each phone:

1. Open Schwing.
2. Go to Me.
3. Enter a player code, for example `SEAN` or `TOM`.
4. Add a display name.
5. Tap Save to cloud.

After that, changes to handicap, club distances, and round notes are saved to that player code.
