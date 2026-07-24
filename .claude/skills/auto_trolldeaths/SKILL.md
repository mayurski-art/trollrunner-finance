---
name: auto_trolldeaths
description: Batch-add a set of FUD and/or Guardian tweets to the Troll Finance timeline (Trolldeaths) without manually pasting each one into admin.html. Triggers on "run auto_trolldeaths", "auto_trolldeaths this", or "add these tweets to guardian/fud".
---

# auto_trolldeaths

Bulk equivalent of pasting tweets into `trollrunner-finance/admin.html` one at
a time. The user hands you a batch of X links (usually already split into
"these are guardian" / "these are fud"), and you turn each into a timeline
entry with an accurate date/time, a real (non-copy-pasted) title + summary,
and push it into the live Supabase timeline — the same place admin.html
writes to.

## When the user invokes this

They'll say something like "run auto_trolldeaths on these" followed by a
list of `x.com/.../status/...` links, and usually tell you which list is FUD
vs Guardian. If they don't label them, ask — don't guess (mode is easy to
get wrong and there's no cheap way to undo a bad classification once it's
live).

## Step 1 — Fetch real tweet data (never trust displayed/pasted dates)

For each tweet URL, extract the numeric status id, then hit the syndication
endpoint with a computed token (plain `id=...` with no token usually returns
`{}`):

```js
function tokenFor(id) {
  return ((Number(id) / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, "");
}
// GET https://cdn.syndication.twimg.com/tweet-result?id=<id>&lang=en&token=<tokenFor(id)>
// header: User-Agent: Mozilla/5.0
```

The response gives `text`, `created_at` (ISO, exact — this is the
authoritative `eventDate`, not anything parsed from a pasted timestamp
string), `user.screen_name`, `favorite_count`, `conversation_count`,
`retweet_count`, and sometimes `views.count`.

**Long-form "note tweets" get truncated** at ~280 chars in this response
(no separate full-text field, just an opaque `note_tweet.id`). Direct
`x.com` page fetches also get blocked (402/login-wall) for unauthenticated
tools. If a tweet's text clearly cuts off mid-sentence, tell the user which
ones and ask them to paste the full text (they can copy it straight off the
tweet) — do not guess the ending or fabricate content.

## Step 2 — Write the title and summary yourself

Do not run the crude clause-extraction algorithm from `admin.html`'s
`summarizeTitle`/`summarizeTweetBody` as the final output — it frequently
grabs the wrong clause (picks a long rambling fragment over the actual
point of the tweet). Instead, read the full tweet text and hand-write:

- **Title**: `"<handle>: <short claim, title-cased>"` — matches the
  existing archive's convention (see any entry in the live timeline).
- **Copy**: 1–3 sentences, paraphrased (not quoted verbatim), same tone as
  existing entries — dry, matter-of-fact, treats the tweet as a "receipt"
  being filed rather than reacting to it.

## Step 3 — Tags and metrics

Tag shape used by real admin-saved entries: `[monthTag, kind, ...2-3
concept tags]`, e.g. `["july-2026", "guardian", "conviction", "belief"]`.
`monthTag` = `eventDate` formatted as lowercase `month-year` (e.g.
`new Date(eventDate).toLocaleString(undefined,{month:"long",year:"numeric"}).toLowerCase().replace(/\s+/g,"-")`).

`metrics: { likes: favorite_count, views: views.count||0, replies:
conversation_count, reposts: retweet_count }` from the fetched tweet data.

`id`: `finance-<some unique millisecond-ish number>` (matches the id shape
`admin.html`'s `getFormEntry()` generates via `finance-${Date.now()}`).

## Step 4 — Pull the LIVE Supabase state before writing anything

**The committed `assets/data/finance-timeline.json` in git can be
significantly behind the live Supabase row** — entries saved through
admin.html only get written to Supabase, not back to the repo. Always
GET the live row first and treat it as ground truth; never build off the
git JSON file alone.

```
GET https://tjsyhfplxjtakdfkpdtg.supabase.co/rest/v1/site_updates?select=updates&id=eq.finance_timeline&limit=1
headers: apikey: <anon key from admin.html>, Authorization: Bearer <anon key>
```

Check each new entry's `sourceHref` against the live set's `sourceHref`s
and skip any duplicates.

## Step 5 — Push to Supabase (this is what makes it "live")

The write RPC is admin-locked (anon key alone gets rejected). You need a
real admin session token. Ask the user to:

1. Open `admin.html`, log in normally.
2. Open the browser console and run `await window.TrollrunnerAdminAuth.getAccessToken()`.
3. Paste you the resulting JWT (short-lived — use it right away).

Then append the new entries to the live array (don't touch/reorder existing
ones) and push the whole thing back in one call:

```
POST https://tjsyhfplxjtakdfkpdtg.supabase.co/rest/v1/rpc/troll_admin_replace_site_row
headers: apikey: <anon key>, Authorization: Bearer <admin access token>, Content-Type: application/json
body: { "p_updates": <full merged array>, "p_row_id": "finance_timeline" }
```

A `{"saved": true}` response with HTTP 200 confirms it. Re-GET the row
afterward and confirm the new count (`old count + new entries, minus any
skipped duplicates`) to verify — don't just trust the 200.

## Step 6 — Reconcile the git baseline

After confirming the live push, sync `assets/data/finance-timeline.json` to
match the new live array exactly (strip the `id` field if you want to match
the older baseline's plainer style, or keep it — either round-trips fine
through `normalizeTimelineItem` on load). This file was found to be ~56
entries behind live as of 2026-07-23, so don't assume it was already
current going in. Show the user the diff stat and ask before committing —
don't commit/push without confirmation.

## Timeline controls need no manual update

The tag filter chips, month/year buttons, sort options, and the total-count
stat on the finance page (`renderTimelineControls()` / `doom-total` in
`index.html`) are all computed live from `financeTimelineItems` on every
page load — new tags and months (e.g. a fresh `og-meme` tag or a new
`july-2026` bucket) show up automatically once entries exist in Supabase.
Nothing there needs editing. The only static, hand-maintained block near the
timeline is `TROLL_DEATH_NOTES` (~line 1899 of `index.html`) — general
methodology notes ("Chart source", "Timeline sourcing", "Why this exists"),
unrelated to individual entries and out of scope for this skill.

## Things that went wrong once, don't repeat

- Building the merge off the git JSON file instead of the live Supabase row
  would have silently deleted dozens of real live entries on push. Always
  fetch live first.
- The mechanical `summarizeTitle`/`summarizeTweetBody` port from
  `admin.html` produces technically-valid but low-quality titles (wrong
  clause picked, generic filler copy). Read the tweets and write these by
  hand; use the mechanical version only as a tags/date/id scaffold if at
  all.
