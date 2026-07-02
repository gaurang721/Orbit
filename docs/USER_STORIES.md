# fbclone — Full User Stories

Complete user-story catalogue for **fbclone**, a Facebook-inspired social platform
(Next.js 15 · Node/Express · Prisma · PostgreSQL · Socket.io · WebRTC).

- **Format:** *As a \<role\>, I want \<capability\>, so that \<benefit\>* — with **Acceptance Criteria (AC)**.
- **Status:** ✅ Implemented · 🔶 Partial · ⬜ Not yet.

## Table of Contents

1. [Authentication & Account](#epic-1--authentication--account)
2. [Profiles](#epic-2--profiles)
3. [Posts & Feed](#epic-3--posts--feed)
4. [Reactions & Comments](#epic-4--reactions--comments)
5. [Polls](#epic-5--polls)
6. [Friends & Following](#epic-6--friends--following)
7. [Notifications](#epic-7--notifications-real-time)
8. [Stories](#epic-8--stories)
9. [Messenger (Chat)](#epic-9--messenger-chat)
10. [Voice & Video Calls](#epic-10--voice--video-calls)
11. [Groups](#epic-11--groups)
12. [Pages](#epic-12--pages)
13. [Marketplace](#epic-13--marketplace)
14. [Events](#epic-14--events)
15. [Discovery & Content Hubs](#epic-15--discovery--content-hubs)
16. [Admin & Moderation](#epic-16--admin--moderation)
17. [Experience & Theming](#epic-17--experience--theming)
18. [Non-Functional Requirements](#non-functional-requirements)

## Personas

| Persona | Description |
|---|---|
| **Visitor** | Not logged in; can only register or log in. |
| **Member** | A registered, logged-in user — the core persona. |
| **Friend / Follower** | A member connected to another member. |
| **Group Admin** | A member who owns/administers a group. |
| **Page Owner** | A member who owns a Page. |
| **Seller / Buyer** | A member using Marketplace. |
| **Moderator / Admin / Super Admin** | Staff roles with escalating privileges. |

---

## Epic 1 — Authentication & Account

### US-1.1 — Register ✅
As a **visitor**, I want to register with my name, email/username and password, so that I can create an account.
- **AC:** Required fields validated (Zod); duplicate email/username rejected with a clear message.
- **AC:** Password is hashed with bcrypt; never stored or returned in plaintext.
- **AC:** On success I'm auto-logged-in and a verification email is dispatched.

### US-1.2 — Log in ✅
As a **member**, I want to log in with my username **or** email plus password, so that I can access my account.
- **AC:** Correct credentials return the user and an access token.
- **AC:** Wrong credentials return a generic error (no user-enumeration).
- **AC:** Banned/inactive accounts are blocked at login with an explanation.

### US-1.3 — Persistent session ✅
As a **member**, I want my session kept alive via a rotating refresh token, so that I stay logged in securely.
- **AC:** Access token lives in memory; refresh token is an httpOnly cookie scoped to `/api/v1/auth`.
- **AC:** Only a SHA-256 hash of the refresh token is stored server-side.
- **AC:** Reuse of a rotated token triggers reuse-detection and nukes the session family.

### US-1.4 — Two-factor authentication ✅
As a **member**, I want to enable TOTP 2FA, so that my account is protected even if my password leaks.
- **AC:** I can stage a secret, confirm with a code, and 2FA becomes required at login.
- **AC:** Login with 2FA requires a valid TOTP challenge before issuing tokens.
- **AC:** I can disable 2FA after re-authenticating.

### US-1.5 — Verify email ✅
As a **member**, I want to verify my email address, so that my account is trusted.
- **AC:** A verification link is issued on register and via a "Resend" action.
- **AC:** Clicking a valid link marks the email verified; the banner disappears.
- **AC:** Links are single-use and expire after 24 hours.

### US-1.6 — Reset password ✅
As a **member**, I want to reset a forgotten password via an emailed link, so that I can regain access.
- **AC:** Requesting a reset always responds success (no enumeration).
- **AC:** The reset link expires in 1 hour and is single-use.
- **AC:** Setting a new password invalidates outstanding reset tokens.

### US-1.7 — Log out & revoke ✅
As a **member**, I want to log out and revoke my session immediately, so that it can't be reused.
- **AC:** Logout clears the refresh cookie and invalidates the session server-side.
- **AC:** Revocation takes effect on active requests within ~20s (session cache TTL).

### US-1.8 — Enforce bans ✅
As an **admin**, I want banned/inactive accounts blocked, so that abusive users lose access.
- **AC:** Ban is enforced at login and on active sessions within ~20s.
- **AC:** Temporary bans auto-expire.

---

## Epic 2 — Profiles

### US-2.1 — My profile ✅
As a **member**, I want a public profile at `/u/:username` with avatar, cover, bio, and details, so that others can learn about me.
- **AC:** Profile shows avatar, cover, name, bio, location, and my posts.
- **AC:** Missing optional fields degrade gracefully.

### US-2.2 — View others ✅
As a **member**, I want to view another member's profile and posts (respecting privacy), so that I can engage.
- **AC:** Friends see FRIENDS-privacy posts; non-friends see only PUBLIC.
- **AC:** A "Message" button starts/opens a conversation.

### US-2.3 — Profile visibility ✅
As a **member**, I want to control my profile visibility, so that I choose who sees my details.
- **AC:** Visibility setting (public/friends) is respected across views.

---

## Epic 3 — Posts & Feed

### US-3.1 — Text post ✅
As a **member**, I want to publish a text post, so that I can share updates.
- **AC:** Empty posts (no text, media, or poll) are rejected.
- **AC:** New post appears at the top of my feed immediately.

### US-3.2 — Media post ✅
As a **member**, I want to attach photos/videos, so that I can share media.
- **AC:** Multiple images render in a grid; videos use a player with fullscreen.
- **AC:** Uploads are validated by real file signature.

### US-3.3 — Background post ✅
As a **member**, I want to post on a colored background, so that short text stands out.
- **AC:** Choosing a background renders text centered on that color.

### US-3.4 — Privacy ✅
As a **member**, I want to set post privacy (Public / Friends / Only me), so that I control the audience.
- **AC:** Feed queries honor privacy per viewer relationship.

### US-3.5 — Home feed ✅
As a **member**, I want a home feed (mine + friends + public), newest first with infinite scroll, so that I can catch up.
- **AC:** Cursor pagination with "load more"; group/page posts excluded.
- **AC:** Reactions/comments/edits update live across the feed.

### US-3.6 — Edit post ✅
As a **member**, I want to edit my own post's text/privacy, so that I can fix mistakes.
- **AC:** Only the author can edit; an "Edited" label appears.
- **AC:** An edit cannot empty a post that has no media/background.

### US-3.7 — Delete post ✅
As a **member**, I want to delete my own post, so that I can remove content.
- **AC:** Only the author can delete; linked hashtag counts decrement.

### US-3.8 — Permalink ✅
As a **member**, I want a permalink page at `/post/:id`, so that I can link directly to a post.
- **AC:** Valid id renders the post; unknown id shows a friendly "not found".

### US-3.9 — Share link ✅
As a **member**, I want to copy a post's share link, so that I can share it elsewhere.
- **AC:** The Share button copies the permalink to the clipboard.

---

## Epic 4 — Reactions & Comments

### US-4.1 — React ✅
As a **member**, I want to react with one of 7 reactions (Like/Love/Care/Haha/Wow/Sad/Angry), so that I can express how I feel.
- **AC:** Clicking the same reaction toggles it off; counts update live.
- **AC:** The author is notified on a new (non-toggle) reaction.

### US-4.2 — Comment ✅
As a **member**, I want to comment on a post, so that I can join the conversation.
- **AC:** Comment count updates live; the author is notified.

### US-4.3 — Reply to comment ✅
As a **member**, I want to reply to a comment (threaded), so that replies stay in context.
- **AC:** Replies link to their parent comment.

### US-4.4 — Mentions ✅
As a **member**, I want @mentions in posts and comments to notify and link that user, so that I can address people.
- **AC:** Case-insensitive handle resolution; a MENTION notification is sent (self excluded).
- **AC:** Mentions render as links to `/u/:username`.

### US-4.5 — Hashtags ✅
As a **member**, I want #hashtags to be clickable and indexed, so that I can browse topics and trending tags.
- **AC:** Tags link to `/hashtag/:tag`; a trending widget lists top tags.
- **AC:** A repeated tag in one post counts once; deleting a post decrements counts.

---

## Epic 5 — Polls

### US-5.1 — Create poll ✅
As a **member**, I want to attach a poll (2–8 options, optional duration), so that I can ask my network.
- **AC:** Question and 2–8 non-empty options required; optional expiry set.

### US-5.2 — Vote ✅
As a **member**, I want to vote (single or multiple choice) and see live percentages, so that I can participate.
- **AC:** Single-choice rejects >1 selection; closed polls reject votes.
- **AC:** Percentages and my selection reflect immediately.

### US-5.3 — Change vote ✅
As a **member**, I want to change or clear my vote before close, so that I can update my choice.
- **AC:** Re-voting swaps selection; empty selection clears my vote.

---

## Epic 6 — Friends & Following

### US-6.1 — Friend requests ✅
As a **member**, I want to send, accept, and decline friend requests, so that I can build my network.
- **AC:** Requests notify the recipient; accept establishes a friendship both ways.

### US-6.2 — Follow ✅
As a **member**, I want to follow/unfollow members, so that I can see updates without a mutual connection.
- **AC:** Follow state toggles and persists.

### US-6.3 — Message from profile ✅
As a **member**, I want to message someone from their profile, so that I can start a chat quickly.
- **AC:** "Message" opens (or creates) the 1:1 conversation, ready to send the first message.

---

## Epic 7 — Notifications (Real-time)

### US-7.1 — Receive notifications ✅
As a **member**, I want real-time notifications (bell + unread badge) for reactions, comments, mentions, friend requests, messages, etc., so that I never miss activity.
- **AC:** New events push over Socket.io; the badge count updates without refresh.

### US-7.2 — Act on a notification ✅
As a **member**, I want to open a notification and land on the relevant content, so that I can respond in one click.
- **AC:** Each notification carries a deep link; opening marks it read.

---

## Epic 8 — Stories

### US-8.1 — Create story ✅
As a **member**, I want to create a photo or text story, so that I can share ephemeral moments.
- **AC:** Photo (upload) or text (with background) supported; caption optional.

### US-8.2 — View stories ✅
As a **member**, I want stories grouped by author in a bar and viewed full-screen with auto-advance, so that browsing is smooth.
- **AC:** Progress bars auto-advance; tapping navigates prev/next.

### US-8.3 — React & viewers ✅
As a **member**, I want to react to a story and (as author) see who viewed it, so that I get feedback.
- **AC:** Reactions recorded; authors see a viewers list with counts.

### US-8.4 — Expiry ✅
As a **member**, I want stories to expire after 24 hours, so that they stay ephemeral.
- **AC:** Expired stories are hidden and purged hourly.

---

## Epic 9 — Messenger (Chat)

### US-9.1 — 1:1 chat ✅
As a **member**, I want real-time 1:1 chat at `/messages`, so that I can talk privately.
- **AC:** Messages deliver instantly to the other participant; history is paginated.

### US-9.2 — Group chat ✅
As a **member**, I want group chats (3+ people) with names and per-sender labels, so that I can talk with several people.
- **AC:** Requires ≥2 other members; sender name/avatar shown above others' bubbles.

### US-9.3 — Typing & receipts ✅
As a **member**, I want typing indicators and Seen/Sent receipts (1:1), so that I know the conversation state.
- **AC:** Typing shows "X is typing…"; last own message shows Sent/Seen.

### US-9.4 — Voice notes ✅
As a **member**, I want to record and send voice notes with playback and duration, so that I can send audio quickly.
- **AC:** Record → live timer → send; playback shows waveform + duration.

### US-9.5 — Upload audio ✅
As a **member**, I want to upload an existing audio file as a voice message, so that I can share pre-recorded audio.
- **AC:** Picking an audio file sends it through the voice pipeline with correct duration and extension.

### US-9.6 — File sharing ✅
As a **member**, I want to send documents (PDF/DOC/XLS/PPT/ZIP/TXT/CSV) as downloadable file cards, so that I can share files.
- **AC:** File card shows type icon, name, and size; content is validated by magic bytes.
- **AC:** Non-allowed/spoofed types are rejected.

### US-9.7 — Emoji picker ✅
As a **member**, I want an emoji picker (search + recent + hundreds of emojis) in the composer, so that I can add emojis easily.
- **AC:** Popup with search and category tabs; recent emojis persist locally.

### US-9.8 — Forward ✅
As a **member**, I want to forward a message to other conversations, so that I can share it.
- **AC:** Forwarded messages are labeled and copy attachments.

### US-9.9 — Unsend ✅
As a **member**, I want to unsend (delete for everyone) my own message, so that I can retract mistakes.
- **AC:** Content/attachments are stripped, leaving a tombstone for everyone in real time.

### US-9.10 — Message info ✅
As a **member**, I want to see message info (sent/forwarded/seen), so that I understand delivery.
- **AC:** An info dialog shows type, timestamps, and Seen/Sent.

---

## Epic 10 — Voice & Video Calls

### US-10.1 — Start a call ✅
As a **member**, I want to start a 1:1 voice or video call from a chat, so that I can talk live.
- **AC:** WebRTC peer connection with STUN (TURN configurable); video carries a video flag.

### US-10.2 — Ring app-wide ✅
As a **member**, I want incoming calls to ring on any page with accept/decline, so that I don't miss calls.
- **AC:** A global overlay rings; accepting connects, declining ends.

### US-10.3 — In-call controls ✅
As a **member**, I want mute, camera toggle, and a call timer, so that I can control the call.
- **AC:** Toggling flips track enabled state; timer counts connected duration.

### US-10.4 — Call log & Calls screen ✅
As a **member**, I want finished calls logged in the thread and on a `/calls` screen with a dialer, so that I can review and start calls.
- **AC:** Caller posts a SYSTEM call-log message; `/calls` lists history and a dialer.

---

## Epic 11 — Groups

### US-11.1 — Create/join/leave ✅
As a **member**, I want to create (public/private) and browse/join/leave groups, so that I can find communities.
- **AC:** Public join is immediate; private join creates a request.

### US-11.2 — Group detail ✅
As a **member**, I want a group detail page with header, members, and feed, so that I can engage inside the group.
- **AC:** Header shows privacy, member count, description, and a members strip.

### US-11.3 — Post in group ✅
As a **group member**, I want to post inside a group (members-only), so that content stays in the community.
- **AC:** Non-members get 403; group posts are excluded from the home feed.

### US-11.4 — Private gate ✅
As a **visitor to a private group**, I want a "join to see posts" gate, so that private content stays private.
- **AC:** Non-members of private/secret groups cannot read posts (403 / locked card).

### US-11.5 — Approve join requests ⬜
As a **group admin**, I want to approve/deny join requests, so that I control membership.
- **AC:** Pending requests are listed with approve/deny actions.

### US-11.6 — Manage members ⬜
As a **group admin**, I want to remove/promote members, so that I can moderate.
- **AC:** Admins can change roles and remove members.

---

## Epic 12 — Pages

### US-12.1 — Create/follow ✅
As a **member**, I want to create and follow Pages, so that I can represent a brand/figure and follow others.
- **AC:** Follower count updates on follow/unfollow.

### US-12.2 — Page detail ✅
As a **member**, I want a Page detail page with header, about, and feed, so that I can view a Page.
- **AC:** Shows cover/avatar/name/type/category/followers and its posts.

### US-12.3 — Post as Page ✅
As a **page owner**, I want to publish posts as my Page (owner-only), so that I can broadcast updates.
- **AC:** Non-owners get 403; page posts excluded from the home feed.

---

## Epic 13 — Marketplace

### US-13.1 — List a product ✅
As a **seller**, I want to list a product with images, price, category, and description, so that I can sell it.
- **AC:** Listing appears in the marketplace and on its detail page.

### US-13.2 — Browse & filter ✅
As a **buyer**, I want to browse, search, and filter by category, so that I can find items.
- **AC:** Search and category filters narrow the results.

### US-13.3 — Save & message seller ✅
As a **buyer**, I want to save listings and message the seller via chat, so that I can follow up.
- **AC:** Saved items appear in Saved; "Message seller" opens a conversation.

---

## Epic 14 — Events

### US-14.1 — Create/list events ✅
As a **member**, I want to create and list events, so that I can organize gatherings.
- **AC:** Events appear in the list with date and details.

### US-14.2 — RSVP ✅
As a **member**, I want to RSVP (Going / Interested), so that organizers know attendance.
- **AC:** My RSVP state persists and is reflected in counts.

### US-14.3 — Event detail page ⬜
As a **member**, I want a dedicated event detail page, so that I can see full event info.
- **AC:** A `/events/:id` page shows full details and attendees.

---

## Epic 15 — Discovery & Content Hubs

### US-15.1 — Global search ✅
As a **member**, I want search across people/posts/groups/pages/marketplace, so that I can find anything.
- **AC:** A results page and nav box return matches per category.

### US-15.2 — Watch/Video ✅
As a **member**, I want a Watch hub with a video feed and full-featured player (fullscreen), so that I can watch videos.
- **AC:** Real video posts appear; player supports fullscreen and controls.

### US-15.3 — Saved ✅
As a **member**, I want to save posts and marketplace items to a Saved page, so that I can revisit them.
- **AC:** Saving from a post menu / listing adds it to `/saved`.

### US-15.4 — Extra surfaces ✅
As a **member**, I want Memories, a Menu shortcut grid, and a Gaming arcade with playable games, so that I have extra engagement.
- **AC:** Memories shows my past posts; Gaming launches self-contained games in a modal.

---

## Epic 16 — Admin & Moderation

### US-16.1 — Report content ✅
As **any member**, I want to report content, so that staff can review it.
- **AC:** A report is created and enters the moderation queue.

### US-16.2 — Admin dashboard ✅
As a **moderator**, I want a dashboard with stats and a reports queue (resolve/dismiss), so that I can moderate.
- **AC:** `/admin` is role-gated; reports can be resolved or dismissed.

### US-16.3 — Ban users ✅
As an **admin**, I want to ban/unban users, so that I can enforce policy.
- **AC:** Ban takes effect within ~20s; actions require ADMIN+.

### US-16.4 — Manage roles ✅
As a **super admin**, I want to change user roles, so that I can manage staff.
- **AC:** Role changes require SUPER_ADMIN.

### US-16.5 — Audit log ✅
As **staff**, I want privileged actions recorded in an audit log, so that actions are accountable.
- **AC:** Ban/role changes and reports are audited.

---

## Epic 17 — Experience & Theming

### US-17.1 — Familiar layout ✅
As a **member**, I want a Facebook-style 3-column layout, so that navigation is familiar.
- **AC:** Left sidebar, center feed, right sidebar; all nav links route to real pages.

### US-17.2 — Dark theme + toggle ✅
As a **member**, I want a dark theme by default with a light-mode toggle and animations, so that the app is comfortable.
- **AC:** Theme persists; toggle switches instantly.

### US-17.3 — Friendly error states ✅
As a **member**, I want error/loading/not-found pages, so that failures aren't blank screens.
- **AC:** Route-level `error`, `loading`, `not-found`, and `global-error` boundaries exist.

---

## Non-Functional Requirements

### NFR-1 — Security ✅
As a **user**, I want strong auth (bcrypt hashing, rotating refresh tokens with reuse-detection, DB-backed session checks, rate limiting), so that my account is safe.

### NFR-2 — Upload safety ✅
As the **platform**, I want uploads validated by magic bytes and served with `X-Content-Type-Options: nosniff`, so that disguised/malicious files are rejected.

### NFR-3 — Storage ✅
As the **platform**, I want media on local disk by default and S3-compatible storage when configured, so that it scales horizontally.

### NFR-4 — Real-time scale ✅
As the **platform**, I want Socket.io with an optional Redis adapter, so that real-time works across multiple nodes.

### NFR-5 — Config safety ✅
As an **operator**, I want env validated with Zod (rejecting weak secrets in production), so that misconfiguration fails fast.

### NFR-6 — Type safety ✅
As a **developer**, I want shared DTO/validation types across API and web, so that the contract stays consistent.

---

_Status as of 2026-07-01. Remaining ⬜ items: group join-request approval UI (US-11.5), group member management (US-11.6), and event detail pages (US-14.3)._
