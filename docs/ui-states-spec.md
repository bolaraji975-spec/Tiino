# Tino UI States Specification

**Version:** 1.0 — May 2025  
**Source:** `docs/tino-copy-spec.docx` · `tickets/fixtures/tino-app-screens-reference.html`

Every state listed here defines: heading, body copy, CTA label, and any inline message or toast.  
All copy follows the Tino tone of voice: direct, specific, active voice, contractions fine.  
Error messages always say what went wrong and what to do next.  
Empty states always include a next action.

---

## Table of Contents

1. [Auth Flow](#1-auth-flow)
2. [Onboarding](#2-onboarding)
3. [Jobs Feed](#3-jobs-feed)
4. [Job Detail](#4-job-detail)
5. [CV Generation](#5-cv-generation)
6. [Support Statement](#6-support-statement)
7. [Application Tracker](#7-application-tracker)
8. [Tracker Stage Forms](#8-tracker-stage-forms)
9. [Dashboard / Analytics](#9-dashboard--analytics)
10. [Saved Searches](#10-saved-searches)
11. [Email Digests](#11-email-digests)
12. [Pricing Page](#12-pricing-page)
13. [Checkout / Stripe](#13-checkout--stripe)
14. [Account Settings](#14-account-settings)
15. [Admin](#15-admin-internal)
16. [Error Pages](#16-error-pages)
17. [Global UI Elements](#17-global-ui-elements)

---

## 1. Auth Flow

### 1.1 Login Page

#### Idle

| Element | Copy |
|---|---|
| Page heading | Welcome back. |
| Page subtitle | Sign in to your sponsorship tracker. |
| Email field label | Email address |
| Email placeholder | you@example.com |
| Password field label | Password |
| Forgot password link | Forgot password? |
| Primary CTA | Sign in → |
| Divider | or continue with |
| Google button | Continue with Google |
| Sign-up prompt | Don't have an account? Create one free → |

#### Sending magic link (after user requests passwordless link)

| Element | Copy |
|---|---|
| Button state (loading) | Sending… |
| Inline feedback | Sending your sign-in link… |

#### Link sent

| Element | Copy |
|---|---|
| Inline feedback | Check your email — we've sent a sign-in link. |
| Sub-text | It expires in 10 minutes. Check your spam folder if it doesn't arrive. |
| Resend link | Send again |

#### Verifying (user has clicked the link, page is processing)

| Element | Copy |
|---|---|
| Page heading | Signing you in… |
| Body | Just a moment. |

#### Error — wrong password

| Element | Copy |
|---|---|
| Inline error (below password field) | Incorrect password. Try again or reset it. |
| Reset link | Reset password → |

#### Error — email not found

| Element | Copy |
|---|---|
| Inline error (below email field) | No account with that email. Create one free → |

#### Error — Google auth failed

| Element | Copy |
|---|---|
| Inline error | Google sign-in failed. Try your email instead. |
| Fallback CTA | Use email instead → |

#### Error — too many attempts

| Element | Copy |
|---|---|
| Inline error | Too many attempts. Wait 5 minutes and try again, or reset your password. |

#### Already logged in

User is redirected silently to `/jobs` on page load. No UI is shown.

---

### 1.2 Magic Link Email

#### Sent

| Element | Copy |
|---|---|
| Subject | Your Tino sign-in link |
| Preview text | Use this to sign in — it expires in 10 minutes. |
| Email heading | Sign in to Tino. |
| Email body | Click the button below to sign in to your sponsorship tracker. This link expires in 10 minutes and can only be used once. |
| CTA | Sign in → |
| Footer note | Didn't request this? Ignore this email — your account is safe. |

#### Expired

| Element | Copy |
|---|---|
| Page heading | That link has expired. |
| Body | Sign-in links expire after 10 minutes. Request a new one and use it straight away. |
| CTA | Request a new link → |

#### Already used

| Element | Copy |
|---|---|
| Page heading | That link has already been used. |
| Body | Each sign-in link works once. If you're not signed in, request a new one. |
| CTA | Request a new link → |

#### Invalid (malformed or unrecognised token)

| Element | Copy |
|---|---|
| Page heading | That link isn't valid. |
| Body | It may have been copied incorrectly. Go back and try signing in again. |
| CTA | Back to sign in → |

---

### 1.3 Google OAuth

#### Initiating (button clicked, popup/redirect opening)

| Element | Copy |
|---|---|
| Button state | Continue with Google (spinner after click) |
| Inline text | Connecting to Google… |

#### Callback (processing after Google redirects back)

| Element | Copy |
|---|---|
| Page heading | Almost there. |
| Body | Signing you in… |

#### Error (OAuth failed or denied)

| Element | Copy |
|---|---|
| Inline error | Google sign-in failed. Try your email instead. |
| Fallback CTA | Use email instead → |

#### Account exists with different provider

| Element | Copy |
|---|---|
| Inline error | You've already signed up with your email address. Sign in with your email to continue. |
| CTA | Sign in with email → |

---

### 1.4 Sign Out

#### Confirming

| Element | Copy |
|---|---|
| Dialog heading | Sign out? |
| Dialog body | You'll need to sign in again to access your tracker. |
| Cancel | Cancel |
| Confirm | Sign out |

#### Success

| Element | Copy |
|---|---|
| Toast | You're signed out. |
| Redirect | `/login` |

#### Session expired (detected mid-session)

| Element | Copy |
|---|---|
| Page heading | Your session has expired. |
| Body | Sign in again to continue where you left off. |
| CTA | Sign in → |

---

## 2. Onboarding

Progress indicator shown throughout: `Step [N] of 4`  
Step labels: Visa type · Profile · Upload CV · Your roles

---

### 2.1 Step 1 — Visa Status

#### Idle

| Element | Copy |
|---|---|
| Heading | What visa are you on? |
| Body | We'll filter jobs to what's actually open to you. |
| Option 1 | Skilled Worker visa |
| Option 2 | Student visa |
| Option 3 | Graduate visa |
| Option 4 | Other / Not sure |
| CTA | Continue → |

#### Option selected

The selected option gains a teal ring. CTA becomes enabled.

#### Validation error (submitted without selection)

| Element | Copy |
|---|---|
| Inline error | Choose your visa type to continue. |

---

### 2.2 Step 2 — Profile

#### Idle

| Element | Copy |
|---|---|
| Heading | Tell us a bit about yourself. |
| Body | This helps us score jobs against your situation. |
| Full name label | Full name |
| Full name placeholder | e.g. Ahsan Tapadar |
| Location label | Preferred location |
| Location placeholder | e.g. London, Manchester, Remote |
| Min salary label | Minimum salary |
| Min salary placeholder | e.g. £50,000 |
| Max salary label | Maximum salary |
| Max salary placeholder | e.g. £120,000 |
| Back | ← Back |
| CTA | Continue → |

#### Filling

Fields show teal active border on focus. No inline messages until submission attempted.

#### Validation error — name missing

| Element | Copy |
|---|---|
| Inline error (below name) | Enter your name to continue. |

#### Validation error — location missing

| Element | Copy |
|---|---|
| Inline error (below location) | Enter a preferred location, or type "Remote". |

#### Validation error — salary min > max

| Element | Copy |
|---|---|
| Inline error (below max salary) | Maximum salary can't be less than the minimum. |

#### Validation error — non-numeric salary

| Element | Copy |
|---|---|
| Inline error (below affected field) | Enter a number, e.g. 50000. |

---

### 2.3 Step 3 — CV Upload

#### Idle

| Element | Copy |
|---|---|
| Heading | Upload your CV. |
| Body | Claude reads it and suggests matching job titles automatically. We never share it with employers. |
| Drop zone headline | Drop your CV here |
| Drop zone subtext | PDF or Word · max 10MB · or click to browse |
| Info banner | Your CV is only used to suggest job titles — never shared with employers. |
| Back | ← Back |
| CTA | Continue → |
| Skip link | Skip for now |

#### Dragging file over zone

| Element | Copy |
|---|---|
| Drop zone headline | Drop it here |
| Drop zone border | Teal solid (active state) |

#### Wrong file type

| Element | Copy |
|---|---|
| Inline error | That file type isn't supported. Upload a PDF or Word doc. |

#### File too large

| Element | Copy |
|---|---|
| Inline error | File too large. Max size is 10MB. |

#### Uploading

| Element | Copy |
|---|---|
| Status text | Uploading… |
| Progress bar | Animated fill shown |

#### Parsing (upload complete, extraction running)

| Element | Copy |
|---|---|
| Status text | Reading your CV… |
| Sub-text | This usually takes under 10 seconds. |

#### Parse failed

| Element | Copy |
|---|---|
| Inline message | We couldn't read that file. Try a different PDF or Word doc. |
| CTA | Try another file |
| Secondary CTA | Skip for now |

#### Parse success

| Element | Copy |
|---|---|
| Status text | CV uploaded. Generating role suggestions… |
| Sub-text | Almost ready. |

---

### 2.4 Step 4 — Role Variations

#### Loading AI suggestions

| Element | Copy |
|---|---|
| Heading | Finding your roles… |
| Body | Claude is reading your CV and matching it to job titles. |

#### Suggestions loaded (normal state)

| Element | Copy |
|---|---|
| Heading | These are the roles we found for you. |
| Body | Add, remove, or reorder them. The feed will match jobs to these titles. |
| Section: Exact match | Your current title |
| Section: Adjacent | Related roles you could apply for |
| Add role placeholder | Add a role title… |
| Add button | + Add |
| Tip | Tip: Include both "Software Engineer" and "SWE" — employers use both. |
| Back | ← Back |
| CTA | Looks good → |

#### No suggestions returned

| Element | Copy |
|---|---|
| Heading | We couldn't find matching roles. |
| Body | Add your job titles manually. Start with your current role, then any related ones. |
| Add role placeholder | Add a role title… |
| CTA | Continue → |

#### Editing a role (input active)

| Element | Copy |
|---|---|
| Input hint | Press Enter to add |

#### Adding a role

Role chip appears inline with a remove (×) button.

#### Removing a role

Chip disappears immediately (optimistic). If list becomes empty, the empty list warning appears.

#### Reordering

Drag handle visible on hover. Dragging state: elevated shadow on the card being moved.

#### Saving

| Element | Copy |
|---|---|
| CTA state | Saving… |

#### Saved

| Element | Copy |
|---|---|
| Toast | Roles saved. Your feed is ready. |
| Redirect | `/jobs` |

#### Empty list warning

| Element | Copy |
|---|---|
| Inline warning | Add at least one role to continue. |
| CTA | Continue → (disabled) |

---

### 2.5 Returning User Bypass

#### Already completed onboarding

User is redirected silently to `/jobs`. No wizard is shown.

#### Partial completion (stopped mid-wizard, returning later)

| Element | Copy |
|---|---|
| Banner (on /jobs) | Finish setting up your account to get personalised results. |
| CTA | Continue setup → |
| Dismiss | ✕ (dismisses for this session) |

---

## 3. Jobs Feed

### 3.1 Loading skeleton

| Element | Copy |
|---|---|
| Topbar subtitle | Finding your jobs… |
| Main content | 3 skeleton card outlines — greyed, pulsing, no text |

---

### 3.2 First load — no role variations set

| Element | Copy |
|---|---|
| Heading | Set your roles first. |
| Body | We need to know what you're looking for before we can find you sponsored jobs. |
| CTA | Add your roles → |

---

### 3.3 Results

| Element | Copy |
|---|---|
| Topbar title | Jobs for you |
| Topbar subtitle | [N] verified sponsor roles · updated today |

#### Filter pills

| Pill | State |
|---|---|
| All roles | Active by default |
| High score | Inactive |
| Direct hire | Inactive |
| Remote | Inactive |
| £40k+ | Inactive |
| New today | Inactive |
| Finance | Inactive |
| Tech | Inactive |

#### Job card — free user view

| Element | Copy |
|---|---|
| Score band | Likely to sponsor / May sponsor / Unlikely to sponsor |
| Numeric score | Hidden — lock icon shown |
| Score breakdown | Hidden |
| Tooltip on score badge | Upgrade to Pro to see the full score breakdown. |

#### Job card — pro user view

| Element | Copy |
|---|---|
| Score band + numeric | Both shown |
| Tooltip on score badge | Score breakdown: Sponsor licence ✓ · Direct hire ✓ · Salary above threshold ✓ · Posted this week ✓ · Matches your profile ✓ |

#### Score badges

| Band | Label | Colour |
|---|---|---|
| 80–100 | Likely to sponsor · [score] | Green |
| 50–79 | May sponsor · [score] | Amber |
| < 50 | Unlikely to sponsor · [score] | Red |
| Unknown | Score not available | Grey |

#### Job card — saved state

| Element | Copy |
|---|---|
| Save button | Saved ✓ |

#### Job card — unsaved state

| Element | Copy |
|---|---|
| Save button | Save |

#### Job card — expired listing

| Element | Copy |
|---|---|
| Card banner | This listing may have closed. The link may no longer work. |
| Apply button | Apply → (shown, greyed) |

---

### 3.4 No results — all filters active

| Element | Copy |
|---|---|
| Heading | No jobs match these filters. |
| Body | Try removing one or broadening your search. |
| CTA | Clear filters |

---

### 3.5 No results — specific filter combination

| Element | Copy |
|---|---|
| Heading | No [filter name] roles right now. |
| Body | [N] verified sponsors have open roles — just not matching this combination. Remove a filter and try again. |
| CTA | Remove [filter name] |

---

### 3.6 No results — no jobs in database yet

| Element | Copy |
|---|---|
| Heading | We haven't found sponsored roles for your titles yet. |
| Body | Check back tomorrow — we refresh daily. |
| CTA | Edit your roles → |

---

### 3.7 Filter states

| State | Visual | Copy |
|---|---|---|
| Inactive | Neutral pill | Label only |
| Active (single) | Teal fill + teal border | Label only |
| Multiple active | Multiple teal pills | Clear filters (shown when 2+ active) |

---

### 3.8 Pagination

#### Load more (available)

| Element | Copy |
|---|---|
| CTA | Load more roles |

#### Loading more

| Element | Copy |
|---|---|
| CTA | Loading… (spinner) |

#### No more jobs

| Element | Copy |
|---|---|
| Message | That's all the sponsored roles for your search. |
| Sub-text | We add new jobs daily. Check back tomorrow. |

---

### 3.9 Save job states

#### Saving (optimistic)

| Element | Copy |
|---|---|
| Button | Saved ✓ (immediate) |

#### Saved (confirmed)

| Element | Copy |
|---|---|
| Toast | Saved to tracker. |

#### Unsave

| Element | Copy |
|---|---|
| Button | Save (reverts) |
| Toast | Removed from tracker. |

#### Save limit reached — free user

| Element | Copy |
|---|---|
| Toast | You've saved 3 jobs — the free plan limit. |
| Upgrade banner | Upgrade to Pro to save unlimited roles and unlock score breakdowns. |
| CTA | See Pro plans → |

---

## 4. Job Detail

### 4.1 Loading

Skeleton layout: logo placeholder · title bar · score badge outline · description lines. No copy shown.

---

### 4.2 Not found / deleted

| Element | Copy |
|---|---|
| Heading | This job is no longer available. |
| Body | It may have been removed by the employer or closed. |
| CTA | Back to jobs → |

---

### 4.3 Job expired (details still shown)

| Element | Copy |
|---|---|
| Top banner | This listing may have closed. Check the employer's site before applying. |
| Apply button | Apply → (shown, amber caution state) |
| All other details | Shown in full |

---

### 4.4 Free user view

| Element | Copy |
|---|---|
| Score display | Band only: Likely to sponsor / May sponsor / Unlikely to sponsor |
| Numeric score | Lock icon — Pro only |
| Locked breakdown heading | See why this job scores high. |
| Locked breakdown body | The full score breakdown shows exactly what signals pushed this job up — or down. |
| CTA | Unlock with Pro → |

---

### 4.5 Pro user view — score breakdown

Heading: **Score breakdown**

| Signal | Points | Label |
|---|---|---|
| On active sponsor register | +40 | On the active Home Office register |
| JD mentions sponsorship | +20 | Direct statement in the job description |
| Salary meets threshold | +15 | Above £38,700 |
| Posted this week | +10 | Fresh listing |
| Matches your profile | +9 | Role title aligns with your saved titles |

#### Negative signals (shown when applicable)

| Signal | Points | Label |
|---|---|---|
| B-rated licence | −15 | Sponsor licence is rated B, not A |
| Salary below threshold | −20 | Listed salary is below £38,700 |
| JD rules out sponsorship | −50 | Employer has explicitly ruled out sponsorship |

---

### 4.6 Employer card

| State | Label | Body |
|---|---|---|
| On register — A rating | Active sponsor · A-rated | On the Home Office sponsor register. A-rated licences are in good standing. |
| On register — B rating | Active sponsor · B-rated | On the register, but rated B. This can indicate a recent compliance issue. |
| Not on register | Not a registered sponsor | We couldn't match this employer to the Home Office register. Apply with caution. |
| Suspended | Sponsor licence suspended | This employer's licence is currently suspended. They can't issue Certificates of Sponsorship. |
| Removed since saved | (Banner) | This employer's sponsor licence has changed since you saved this job. |

Removed-since-saved banner CTA: **Check the register →**

---

### 4.7 Apply button — external link warning

| Element | Copy |
|---|---|
| Warning text | This link goes to the employer's site. We don't control their application process. |
| CTA | Continue to employer site → |
| Cancel | Stay on Tino |

---

### 4.8 Generate CV button (on job detail)

| State | Button copy | Inline message |
|---|---|---|
| Idle | Generate CV ↗ | — |
| Generating | Generating… | — |
| Success | Download CV ↓ | Toast: Your tailored CV is ready to download. |
| Error | Generate CV ↗ | Toast: Something went wrong generating your CV. Try again — it usually works on the second attempt. |
| Cached result | Download CV ↓ | Using your previously generated CV for this job. Regenerate if you've updated your profile. |
| No CV uploaded | Generate CV ↗ (disabled) | Upload a CV first to use CV generation. CTA: Upload your CV → |
| Rate limited | Generate CV ↗ (disabled) | See §5.7 / §5.8 for rate limit copy. |

---

### 4.9 Support statement button (public sector jobs only)

| State | Button copy | Message |
|---|---|---|
| Idle | Generate support statement ↗ | — |
| Generating | Generating statement… | — |
| Success | Download statement ↓ | Toast: Support statement ready. Review each section before submitting. |
| Error | Generate support statement ↗ | Toast: Something went wrong. Try again. |

---

## 5. CV Generation

### 5.1 Pre-generation — no CV uploaded

| Element | Copy |
|---|---|
| Heading | Upload a CV to get started. |
| Body | Claude reads your CV to tailor it for this role. Upload one in your profile settings. |
| CTA | Upload your CV → |

---

### 5.2 Generating — streaming progress steps

| Step | Status copy |
|---|---|
| 1 | Reading job description… |
| 2 | Matching your experience… |
| 3 | Writing tailored bullets… |
| 4 | Checking for accuracy… |

Sub-text shown throughout: This usually takes under 30 seconds.

---

### 5.3 Hallucination check triggered

Shown briefly before final result appears:

| Element | Copy |
|---|---|
| Status message | We noticed the draft included something that wasn't in your CV. We've corrected it and regenerated. |

---

### 5.4 Success

| Element | Copy |
|---|---|
| Heading | Your CV is ready. |
| Body | Review it before downloading. |
| CTA 1 | ↓ Download .docx |
| CTA 2 | ↓ Download cover letter |
| CTA 3 | ↑ Regenerate |
| Preview | CV shown in right panel with teal-highlighted matched keywords |

---

### 5.5 Cached result

| Element | Copy |
|---|---|
| Banner | Using your previously generated CV for this job. Regenerate if you've updated your profile. |
| CTA | ↑ Regenerate |

---

### 5.6 Error — Claude API failed

| Element | Copy |
|---|---|
| Heading | Something went wrong. |
| Body | Something went wrong generating your CV. Try again — it usually works on the second attempt. |
| CTA | Try again |

---

### 5.7 Rate limited — free user (1/month used)

| Element | Copy |
|---|---|
| Heading | You've used your free CV this month. |
| Body | The free plan includes 1 tailored CV per month. Upgrade to Pro for 20 per month, or buy a single credit. |
| CTA 1 | See Pro plans → |
| CTA 2 | Buy a CV credit — £1.99 |

---

### 5.8 Rate limited — pro user (20/month used)

| Element | Copy |
|---|---|
| Heading | You've used all your CVs this month. |
| Body | 20 of 20 CVs used. Your allowance resets on [reset date]. |
| CTA | Buy extra credits → |

---

### 5.9 Pay-per-CV flow

#### 0 credits — prompt to buy

| Element | Copy |
|---|---|
| Inline prompt | You have no CV credits left. Buy one to continue. |
| CTA | Buy a CV credit — £1.99 |

#### Buying credits (redirecting to Stripe)

| Element | Copy |
|---|---|
| Message | Taking you to checkout… |

#### Credits added (return from Stripe success)

| Element | Copy |
|---|---|
| Toast | 1 CV credit added to your account. |

#### Deducting credit (before generation starts)

| Element | Copy |
|---|---|
| Inline note | 1 credit will be deducted when your CV generates. |

---

## 6. Support Statement (Public Sector)

Shown on job detail pages where `isPublicSector = true`.

### 6.1 Criteria extracted automatically

| Element | Copy |
|---|---|
| Heading | We found [N] criteria in this job description. |
| Body | We'll write a STAR paragraph for each one. Review them before downloading. |
| Criteria list | Numbered list of extracted criteria |
| CTA | Generate statement → |

---

### 6.2 No criteria found

| Element | Copy |
|---|---|
| Heading | We couldn't extract the criteria automatically. |
| Body | Paste each selection criterion manually, one per line. |
| Textarea label | Selection criteria |
| Placeholder | e.g. Ability to manage complex stakeholder relationships |
| CTA | Generate statement → |

---

### 6.3 Generating per criterion

| Element | Copy |
|---|---|
| Status (per row) | Writing response for "[Criterion]"… |

---

### 6.4 Success

| Element | Copy |
|---|---|
| Heading | Support statement ready. |
| Body | Review each section before submitting. You can edit directly in the panel. |
| CTA | ↓ Download as .docx |

---

### 6.5 Error

| Element | Copy |
|---|---|
| Toast | Something went wrong writing your statement. Try again. |
| CTA | Try again |

---

### 6.6 Download as DOCX

| Element | Copy |
|---|---|
| CTA | ↓ Download as .docx |
| After click | Downloading… |

---

## 7. Application Tracker

### 7.1 Empty state (no applications)

| Element | Copy |
|---|---|
| Heading | No applications yet. |
| Body | Find a job you like and hit Save to start tracking it here. |
| CTA | Browse jobs → |

---

### 7.2 Kanban board — column order

Saved → CV Generated → Applied → Phone Screen → Interview → Assessment → Offer → Accepted → Rejected / Withdrawn

---

### 7.3 Each column — empty state copy

| Column | Empty state copy |
|---|---|
| Saved | Nothing saved yet. Add a job to start tracking it. |
| CV Generated | No CVs generated yet. Generate one from any job listing. |
| Applied | No applications sent yet. |
| Phone Screen | No phone screens logged. |
| Interview | No interviews scheduled. |
| Assessment | No assessments logged. |
| Offer | No offers yet. Keep going. |
| Accepted | Nothing accepted yet. |
| Rejected / Withdrawn | Nothing archived here yet. |

---

### 7.4 Card details

| Element | Copy / Behaviour |
|---|---|
| Company logo | Brand logo; on failure: 2-letter initials on brand-colour circle |
| Role title | [Title] |
| Company name | [Company] |
| Score band | Likely to sponsor / May sponsor / Unlikely to sponsor |
| Days since applied | [N]d ago / Not applied yet |

---

### 7.5 Drag to move

#### Dragging

| Element | Copy |
|---|---|
| Card state | Elevated shadow; cursor: grab |
| Valid drop zone | Teal outline highlight |

#### Dropped (valid)

| Element | Copy |
|---|---|
| Toast | ✓ Stage updated to [Stage name]. |

#### Invalid drop (e.g. dragging backwards)

| Element | Copy |
|---|---|
| Behaviour | Card snaps back |
| Toast | You can't move an application backwards. Use the Update form to correct a stage. |

---

### 7.6 Click to advance stage

| Current stage | Action button |
|---|---|
| Saved | Generate CV ↗ |
| CV Generated | Update → |
| Applied | Update → |
| Phone Screen | Update → |
| Interview | Update → |
| Assessment | Update → |
| Offer | Accept ✓ |
| Any | Update → |

---

### 7.7 Bulk actions

| Element | Copy |
|---|---|
| Header checkbox | Selects all visible rows |
| Bulk action bar | [N] selected · Archive · Export |
| Archive confirm | Archive [N] applications? You can restore them in account settings. |

---

## 8. Tracker Stage Forms

All forms open in a slide-over panel. Back/close dismisses without saving unless draft was explicitly saved.

### 8.1 Saved → Applied

| Element | Copy |
|---|---|
| Form heading | Mark as applied |
| Date applied (required) | Date applied |
| Method dropdown | How did you apply? — Email / Job portal / In person |
| Notes (optional) | Notes |
| Back | Cancel |
| CTA | Save → |

Validation: **Date applied can't be in the future.**

---

### 8.2 Applied → Phone Screen

| Element | Copy |
|---|---|
| Form heading | Log phone screen |
| Date (required) | Date |
| Interviewer name (optional) | Interviewer name |
| Format | Format — Phone call / Video call |
| Notes (optional) | Notes |
| CTA | Save → |

---

### 8.3 Phone Screen → Interview

| Element | Copy |
|---|---|
| Form heading | Log interview |
| Date (required) | Date |
| Format | Format — In person / Video / Panel |
| Panel names (optional) | Panel members |
| Location (optional) | Location |
| Notes (optional) | Notes |
| CTA | Save → |

Validation: **Check the date — it looks like it might be in the past.** (soft warning, not blocking)

---

### 8.4 Interview → Assessment

| Element | Copy |
|---|---|
| Form heading | Log assessment |
| Date (required) | Date |
| Type | Type — Technical test / Case study / Psychometric / Other |
| Preparation notes (optional) | Preparation notes |
| CTA | Save → |

---

### 8.5 Assessment → Offer

| Element | Copy |
|---|---|
| Form heading | Log offer |
| Date offered (required) | Date of offer |
| Salary offered (required) | Salary offered |
| Sponsorship confirmed | Sponsorship confirmed — Yes / No / TBC |
| Notes (optional) | Notes |
| CTA | Save → |

Validation: **Enter a number, e.g. 65000.**  
Advisory (when salary < threshold): **This salary is below the Skilled Worker threshold of £38,700.**

---

### 8.6 Offer → Accepted

| Element | Copy |
|---|---|
| Form heading | Accept offer |
| Start date (required) | Start date |
| Final salary confirmed (required) | Final salary |
| Notes (optional) | Notes |
| CTA | Accept ✓ |

---

### 8.7 Any → Rejected

| Element | Copy |
|---|---|
| Form heading | Mark as rejected |
| Reason dropdown | Reason — No response / After screening / After interview / After offer / Other |
| Feedback received (optional) | Feedback received |
| CTA | Save → |

---

### 8.8 Any → Withdrawn

| Element | Copy |
|---|---|
| Form heading | Withdraw application |
| Reason dropdown | Reason — Found another role / Changed my mind / Role changed / Other |
| Notes (optional) | Notes |
| CTA | Save → |

---

### 8.9 Form validation errors

| Scenario | Copy |
|---|---|
| Missing required field | [Field name] is required. |
| Invalid date format | Enter a valid date, e.g. 18 Jan 2025. |
| Salary below threshold | This salary is below the Skilled Worker threshold of £38,700. |
| Future date on past event | Check the date — this looks like it's in the future. |

---

### 8.10 Save draft

| Element | Copy |
|---|---|
| Link | Save draft |
| Toast | Draft saved. |

---

### 8.11 Submit success

| Element | Copy |
|---|---|
| Toast | ✓ Stage updated to [Stage name]. |
| Behaviour | Slide-over closes; tracker updates immediately |

---

## 9. Dashboard / Analytics

### 9.1 No data yet (0 applications)

| Element | Copy |
|---|---|
| Heading | Apply to a few jobs and come back here. |
| Body | Your response rate, time to interview, and conversion data will appear once you've sent a few applications. Analytics update daily. |
| CTA | Browse jobs → |

---

### 9.2 With data — stat cards

| Card | Value display | Change copy |
|---|---|---|
| Applications sent | [N] (mono) | ↑ +[N] vs last month (teal) |
| Response rate | [N]% (teal) | ↑ +[N]% vs last month (green) / ↓ −[N]% (red) |
| Avg. to interview | [N]d (mono) | ↑ [N] days faster (green) / ↓ [N] days slower (red) |
| Active offers | [N] (green) | [Company] · £[salary] |

---

### 9.3 Funnel chart

| Stage | Notes |
|---|---|
| Applied | 100% base — teal bar |
| Acknowledged | % of Applied — teal bar |
| Interview | % of Applied — teal bar |
| Offer | % of Applied — green bar |

Each row: stage label · count · progress bar width proportional to % of Applied.

---

### 9.4 Conversion by role type table

| Column | Notes |
|---|---|
| Role type | Role title text |
| Applied | Integer count |
| Response rate | >50% green · 25–50% amber · <25% red |
| Interviews | Integer count |
| Trend | ↑ improving (green) · → stable (grey) · ↓ declining (red) |

---

### 9.5 Sponsorship confirmation rate

| Element | Copy |
|---|---|
| Stat label | Sponsorship confirmed |
| Value | [N]% of offers confirmed sponsorship |
| Sub-text | Based on [N] offer outcomes you've recorded. |

---

### 9.6 Export data

| Element | Copy |
|---|---|
| CTA | Export CSV |
| Toast | Your data is downloading. |

---

### 9.7 No data for period

| Element | Copy |
|---|---|
| Message | No applications in this period. Try switching to All time. |
| CTA | Switch to All time |

---

## 10. Saved Searches

### 10.1 Empty state

| Element | Copy |
|---|---|
| Heading | No saved searches yet. |
| Body | Save a search to get notified when new sponsored roles appear. |
| CTA | + New search |

---

### 10.2 List view

Each row: **[Search name]** · Last run [time ago] · [N] new results · Edit · Delete

---

### 10.3 Create new

| Element | Copy |
|---|---|
| Heading | New saved search |
| Name field label | Search name |
| Name placeholder | e.g. Senior SWE · London |
| Keywords label | Keywords |
| Location label | Location |
| Salary min label | Minimum salary |
| Score band label | Minimum score band |
| Score band options | High · Medium · All |
| CTA | Save search → |

Validation: **Give this search a name.**

---

### 10.4 Edit existing

| Element | Copy |
|---|---|
| Heading | Edit search |
| CTA | Save changes → |

Same fields as create.

---

### 10.5 Delete

| Element | Copy |
|---|---|
| Confirm heading | Remove "[Search name]"? |
| Confirm body | You won't get alerts for it any more. |
| CTA | Remove |
| Cancel | Cancel |
| Toast | Search removed. |

---

### 10.6 Stale results warning

| Element | Copy |
|---|---|
| Banner (on search row) | Last checked [N] days ago. We check daily — new results will appear tomorrow. |

---

## 11. Email Digests

### 11.1 Digest settings (in Notifications tab)

| Element | Copy |
|---|---|
| Toggle label | Daily digest email |
| Toggle body | Get the top 5 new sponsored roles in your inbox every morning. |
| Frequency (Pro only) | Daily · Weekly |
| Job types | Aligned to your saved role titles |

---

### 11.2 Unsubscribe — confirmed

| Element | Copy |
|---|---|
| Heading | Unsubscribed. |
| Body | You won't receive digest emails. Re-enable them any time in your notification settings. |
| CTA | Back to settings → |

---

### 11.3 Unsubscribe — already unsubscribed

| Element | Copy |
|---|---|
| Heading | You're already unsubscribed. |
| Body | No digest emails are being sent to this address. |
| CTA | Back to settings → |

---

### 11.4 No new jobs — digest suppressed

Digest email is not sent. No copy shown to user.

---

### 11.5 Digest email

| Element | Copy |
|---|---|
| Subject | [N] new sponsored roles for you today |
| Preview text | Includes [Company] and [Company]. |
| Heading | New sponsored roles for you. |
| Body | We found [N] new roles from verified sponsors that match your profile. Here are the top 5. |
| Each job row | [Role] · [Company] · [Location] · [Score band] → Apply |
| Footer CTA | See all [N] roles → |
| Unsubscribe link | Unsubscribe |

---

## 12. Pricing Page

### 12.1 Default view (monthly)

| Element | Copy |
|---|---|
| Heading | Straightforward pricing. |
| Sub-heading | Pick the plan that matches where you are in your search. |
| Toggle active | Monthly |
| Toggle inactive | Annual — save 27% |

---

### 12.2 Annual toggle selected

| Element | Copy |
|---|---|
| Badge on Pro card | Save 27% |
| Price shown | £35/yr |
| Comparison note | was £47.88/yr |

---

### 12.3 Plan CTAs

| Scenario | CTA |
|---|---|
| Free — current plan | Your current plan |
| Free — not signed up | Create free account → |
| Upgrade to Pro Monthly | Upgrade to Pro → |
| Upgrade to Pro Annual | Upgrade and save → |
| Downgrade to Free | Switch to free plan |

---

### 12.4 Pay-per-CV block

| Element | Copy |
|---|---|
| Eyebrow | Just need one? |
| Heading | Single CV credit |
| Price line | £1.99 · one-time · credits never expire |
| CTA | Buy a CV credit → |

---

## 13. Checkout / Stripe

### 13.1 Redirecting to Stripe

| Element | Copy |
|---|---|
| Page heading | Taking you to checkout… |
| Body | You're being redirected to our payment provider. It should only take a second. |

---

### 13.2 Return — success (plan activated)

| Element | Copy |
|---|---|
| Toast | Pro plan activated. Your account is fully unlocked. |
| Redirect | `/jobs` |

---

### 13.3 Return — success (credits added)

| Element | Copy |
|---|---|
| Toast | 1 CV credit added to your account. |
| Redirect | Previous page |

---

### 13.4 Return — cancelled

| Element | Copy |
|---|---|
| Toast | Payment cancelled. Your plan hasn't changed. |
| Redirect | `/pricing` |

---

### 13.5 Payment failed

| Element | Copy |
|---|---|
| Heading | Payment didn't go through. |
| Body | Your card was declined. Try again or use a different card. |
| CTA | Try again → |

---

### 13.6 Subscription already active

| Element | Copy |
|---|---|
| Toast | Your Pro plan is already active. |
| Redirect | `/account/subscription` |

---

## 14. Account Settings

### 14.1 Profile tab

| Element | Copy |
|---|---|
| Tab heading | Profile |
| Full name label | Full name |
| Email label | Email address |
| Visa status label | Visa status |
| Location label | Location |
| CTA | Save changes → |
| Toast | ✓ Profile saved. |

---

### 14.2 Subscription tab

| Element | Copy |
|---|---|
| Tab heading | Your subscription |
| Free plan line | Free plan · 1 CV/month · 3 saved jobs |
| Pro Monthly line | Pro Monthly · £3.99/mo · Renews [date] |
| Pro Annual line | Pro Annual · £35/yr · Renews [date] |
| Cancel CTA | Cancel subscription |
| Upgrade CTA | Upgrade to Pro → |
| Downgrade CTA | Switch to free plan |

---

### 14.3 Notifications tab

| Element | Copy |
|---|---|
| Tab heading | Notifications |
| Digest toggle label | Daily digest |
| Digest toggle body | Top 5 new sponsored roles every morning. |
| Frequency (Pro) | Daily / Weekly |
| New results alert label | Alert when saved searches find new jobs |
| CTA | Save preferences → |
| Toast | ✓ Preferences saved. |

---

### 14.4 Data tab

| Element | Copy |
|---|---|
| Tab heading | Your data |
| Export heading | Export your data |
| Export body | Downloads your applications, saved jobs, and profile as a CSV. |
| Export CTA | Export all data |
| Export toast | Your data is downloading. |
| Delete section heading | Delete account |
| Delete section body | This permanently removes your data, cancels your subscription, and can't be undone. |
| Delete CTA | Delete account → |

---

### 14.5 Delete account flow

#### Step 1 — confirm intent

| Element | Copy |
|---|---|
| Dialog heading | Delete your account? |
| Dialog body | All your data will be permanently removed in 30 days. Your Stripe subscription will be cancelled immediately. |
| CTA | Continue → |
| Cancel | Cancel |

#### Step 2 — type email to confirm

| Element | Copy |
|---|---|
| Instruction | Type your email address to confirm. |
| Placeholder | you@example.com |
| CTA | Delete account (disabled until email matches exactly) |

#### Deleting

| Element | Copy |
|---|---|
| Heading | Deleting your account… |
| Body | This may take a moment. |

#### Deleted

| Element | Copy |
|---|---|
| Heading | Account deleted. |
| Body | Your data will be fully removed within 30 days. Your subscription has been cancelled. |
| Note | No further charges. |

---

## 15. Admin (Internal)

### 15.1 Sponsor register status

| Element | Copy |
|---|---|
| Section heading | Sponsor register |
| Fields | Last refresh · Next refresh · Active sponsor count · Status |
| Status: OK | OK · [timestamp] |
| Status: Stale | Register data is [N] days old. Trigger a refresh manually. |
| Status: Error | Register refresh failed. Check the ingest log. |
| CTA | Refresh register now |

---

### 15.2 Ingestion log

Table columns: **Source / Last run / Status / Jobs added / Errors**

| Status | Colour |
|---|---|
| OK | Green |
| Running | Amber |
| Error | Red |
| Skipped | Grey |

Error rows are expandable with the full error message shown inline.

---

### 15.3 User funnel

| Row | Label |
|---|---|
| 1 | Signups |
| 2 | Onboarding started |
| 3 | Onboarding complete |
| 4 | First job saved |
| 5 | First CV generated |
| 6 | First application sent |

Each row shows: count · % of signups.

---

### 15.4 Manual trigger buttons

| Element | Copy |
|---|---|
| Refresh register | Refresh sponsor register |
| Per-source trigger | Run [source] ingest |
| Confirm dialog heading | Run [source] ingest now? |
| Confirm dialog body | This will count against API quota. |
| Running state | Running [source]… |
| Complete toast | [Source] ingest complete. [N] jobs added. |

---

## 16. Error Pages

### 16.1 404

| Element | Copy |
|---|---|
| Heading | This page doesn't exist. |
| Body | The link may be broken, or the content may have been removed. |
| CTA | Back to jobs → |

---

### 16.2 500

| Element | Copy |
|---|---|
| Heading | Something went wrong. |
| Body | We're working on it. Try again in a few minutes. |
| CTA | Refresh page |

---

### 16.3 Offline / network error

| Element | Copy |
|---|---|
| Heading | No connection. |
| Body | Check your internet and try again. |
| CTA | Retry |

---

### 16.4 Session expired

| Element | Copy |
|---|---|
| Heading | Your session has expired. |
| Body | Sign in again to continue where you left off. |
| CTA | Sign in → |

---

### 16.5 Maintenance mode

| Element | Copy |
|---|---|
| Heading | Tino is down for maintenance. |
| Body | We're making improvements. Back soon. |
| Sub-text | Check @tino_uk for updates. |

---

## 17. Global UI Elements

### 17.1 Navigation — sidebar

#### Free user

| Element | Copy |
|---|---|
| Nav items | Jobs feed · Tracker · CV builder · Analytics |
| Upgrade prompt | Upgrade to Pro for score breakdowns, 20 CVs/month, and unlimited saves. |
| Upgrade CTA | See Pro plans → |

#### Pro user

| Element | Copy |
|---|---|
| Nav items | Jobs feed · Tracker · CV builder · Analytics |
| Pro badge | PRO (teal, mono font) |

#### Admin

| Element | Copy |
|---|---|
| Nav items | Jobs feed · Tracker · CV builder · Analytics · Admin |

---

### 17.2 Mobile hamburger menu

| State | Behaviour |
|---|---|
| Closed | Hamburger icon only |
| Open | Slide-in overlay with all nav items |
| Each link | Full-width row, 48px minimum tap target |

---

### 17.3 Score band pill — all states

| Band | Label | Tooltip |
|---|---|---|
| 80–100 (High) | Likely to sponsor | This job scores above 80. The employer is on the active sponsor register, the JD mentions sponsorship directly, and the salary meets the threshold. |
| 50–79 (Medium) | May sponsor | This job scores 50–79. The employer holds a licence, but the JD doesn't confirm sponsorship directly. |
| < 50 (Low) | Unlikely to sponsor | This job scores below 50. There may be signals that reduce confidence — salary, role type, or no explicit sponsorship mention. |
| Unknown | Score not available | We couldn't calculate a score for this listing yet. |

Free users see band label only. Pro users see label + numeric score + tooltip.

---

### 17.4 Company logo

| State | Behaviour |
|---|---|
| Loaded | Brand logo shown |
| Failed | 2-letter initials on brand-colour circle |

---

### 17.5 Toast notifications

All toasts are dismissable with ✕.

| Type | Duration | Example copy |
|---|---|---|
| Success | 3s | ✓ Saved to tracker. |
| Error | 6s (longer read time) | Something went wrong generating your CV. Try again — it usually works on the second attempt. |
| Warning | 5s | That link has expired. Request a new one → |
| Info | 4s | Using your previously generated CV for this job. |

---

### 17.6 Confirmation dialogs

#### Remove application

| Element | Copy |
|---|---|
| Heading | Remove this application? |
| Body | This can't be undone. |
| Cancel | Cancel |
| Confirm | Remove |

#### Cancel subscription

| Element | Copy |
|---|---|
| Heading | Cancel your subscription? |
| Body | You'll keep Pro access until the end of your current billing period. After that, you'll revert to the free plan. |
| Cancel | Keep Pro |
| Confirm | Cancel subscription |

#### Withdraw application

| Element | Copy |
|---|---|
| Heading | Withdraw this application? |
| Body | It will move to Withdrawn. You can still view it in your tracker. |
| Cancel | Cancel |
| Confirm | Withdraw |

#### Remove saved CV

| Element | Copy |
|---|---|
| Heading | Remove your CV? |
| Body | We'll delete it from our servers immediately. |
| Cancel | Cancel |
| Confirm | Remove CV |

---

### 17.7 Loading skeletons

| Screen | Skeleton content |
|---|---|
| Feed | 3 job card outlines — logo chip + title bar + badge + button row; pulsing |
| Detail | Header bar + score badge + body paragraphs (3 lines) + button bar; pulsing |
| Tracker | 6 table row outlines with cell-width bars; pulsing |
| Dashboard | 4 stat card outlines + bar chart area + funnel area; pulsing |

No copy shown during skeleton state.

---

### 17.8 Upgrade modal

Triggered by: save limit · score breakdown access · CV generation limit.

| Element | Copy |
|---|---|
| Heading | Unlock the full Tino. |
| Body | You've hit the limit on the free plan. |
| Feature list | Score breakdowns · 20 CVs/month · Unlimited saves · Daily digest |
| CTA | See Pro plans → |
| Dismiss | Maybe later |

---

### 17.9 Cookie banner

| Element | Copy |
|---|---|
| Message | We use cookies to keep you signed in and analyse usage. We don't sell your data. |
| CTA 1 (primary) | Accept |
| CTA 2 (ghost) | Decline non-essential |

---

### 17.10 Footer

| Element | Copy |
|---|---|
| Links | Privacy · Terms · Blog · LinkedIn |
| Legal | © 2025 Tino. All rights reserved. |

---

*End of UI States Specification*
