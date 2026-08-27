# Refer & Earn Implementation Plan

## Goal
Implement a complete customer referral flow where:

- Admin sets referral rewards and referral limit
- Existing customer shares a short referral code/link
- Shared link opens a referral landing page
- New customer can sign up with an optional referral code
- System validates the code and blocks wrong/self/expired usage
- On successful signup, both referrer and referred user receive rewards
- Wallet and referral history reflect the reward correctly

## Current State In Repo

### Already available
- User referral fields exist in `Backend/src/core/users/user.model.js`
  - `referralCode`
  - `referredBy`
  - `referralCount`
- Admin referral settings model exists in `Backend/src/modules/food/admin/models/referralSettings.model.js`
  - `referralRewardUser`
  - `referralRewardReferredUser`
  - `referralLimitUser`
  - `isActive`
- Referral logs exist in `Backend/src/modules/food/admin/models/referralLog.model.js`
- User referral stats/details service exists in `Backend/src/modules/food/user/services/userReferral.service.js`
- Referral wallet credit helper exists in `Backend/src/modules/food/user/services/userWallet.service.js`
- Admin referral settings screen exists in `Frontend/src/modules/Food/pages/admin/system/ReferralSettings.jsx`
- User refer page exists in `Frontend/src/modules/Food/pages/user/profile/ReferEarn.jsx`
- Public referral settings endpoint exists in `Backend/src/modules/food/landing/controllers/publicReferralSettings.controller.js`

### Gaps to close
- Share link currently uses user `_id` instead of short `referralCode`
- Backend referral verification currently supports ObjectId-style `ref`, not true short codes
- Admin UI does not expose `referralLimitUser`
- No dedicated referral landing page for shared links
- Signup flow does not clearly support optional referral code entry for new users
- Validation and success/error UX need tightening
- Referral log currently stores one `rewardAmount`, but the flow may need both-side reward details

## Functional Requirements

### Admin
- Admin can configure:
  - reward for referrer user
  - reward for referred user
  - referral limit per user
  - referral active/inactive toggle
- Admin values must be non-negative
- Limit `0` means unlimited only if business approves that behavior

### Referrer user
- User sees a short referral code on Refer & Earn page
- User can copy/share the code and link
- Shared link opens a public referral landing page

### Referred user
- Opening referral link should:
  - open referral landing page
  - show referral code
  - show referral reward message
  - continue into signup
- During signup, referral code is optional
- If code came from link, prefill it
- User can still edit/remove it before completing signup

### Validation
- Invalid code must be rejected
- Self referral must be rejected
- Existing users must not get referral rewards again
- Referrer limit must be enforced
- Inactive referral settings must block reward application

### Reward outcome
- On successful eligible signup:
  - referred user gets bonus
  - referrer gets bonus
  - wallet transactions are created
  - referral history is created
  - referrer count increments

## Technical Design

## Phase 1: Referral Code Foundation

### Objective
Move from Mongo ObjectId referral sharing to short human-readable referral codes.

### Backend changes
- Update `Backend/src/core/users/user.model.js`
  - add unique index on `referralCode`
  - keep field normalized uppercase
- Add referral code generator helper, for example:
  - file: `Backend/src/core/users/referralCode.util.js`
  - format: 6 to 8 uppercase alphanumeric chars
- Ensure new users always receive a short code on creation
- Backfill old users whose `referralCode` is:
  - missing
  - empty
  - equal to their `_id`

### Rules
- Code must be unique
- Code should avoid ambiguous characters if possible
  - optional: exclude `0`, `O`, `I`, `1`

### Acceptance
- Every user has a non-empty short referral code
- `referralCode` is unique in DB
- No share flow depends on `_id`

## Phase 2: Admin Settings Completion

### Objective
Expose all needed referral controls in admin.

### Frontend changes
- Update `Frontend/src/modules/Food/pages/admin/system/ReferralSettings.jsx`
  - add `referralLimitUser`
  - optionally add `isActive`
  - display helper text for limit behavior

### Backend changes
- Confirm DTO validation accepts:
  - `referralRewardUser`
  - `referralRewardReferredUser`
  - `referralLimitUser`
  - `isActive`
- Reuse existing upsert flow in:
  - `Backend/src/modules/food/admin/services/admin.service.js`
  - `Backend/src/modules/food/admin/controllers/admin.controller.js`

### Suggested UI copy
- Referrer Reward (INR)
- Referred User Reward (INR)
- Referral Limit Per User
- Referral Program Active

### Acceptance
- Admin can save and reload all settings
- Limit value persists correctly
- Invalid negative inputs are blocked

## Phase 3: Public Referral Landing Page

### Objective
Create a clean entry point for shared referral links.

### Route options
- Preferred: `/refer/:code`
- Alternate: `/food/user/auth/login?ref=ABC123`

### Recommendation
Use `/refer/:code` for cleaner sharing, then redirect user into auth while preserving the code.

### Frontend changes
- Add a public page component, for example:
  - `Frontend/src/modules/Food/pages/user/auth/ReferralLanding.jsx`
- Add route in user/app router
- Display:
  - short referral code
  - “Get rewarded on signup”
  - reward amount for new user
  - CTA button: `Continue to Signup`
  - copy code button

### Backend/public API usage
- Use existing public referral settings endpoint:
  - `GET /food/landing/referral-settings`
- Add optional referral-code validation endpoint if needed:
  - `GET /food/auth/referral/validate/:code`

### Acceptance
- Shared link opens landing page
- Page shows code and reward message
- Continue button carries code into signup

## Phase 4: Signup Flow With Optional Referral Code

### Objective
Allow new users to enter referral code safely during signup.

### Current auth flow
- Phone entered in `Frontend/src/modules/Food/pages/user/auth/SignIn.jsx`
- OTP verification handled in `Frontend/src/modules/Food/pages/user/auth/OTP.jsx`
- Backend verification handled by:
  - `Backend/src/core/auth/auth.controller.js`
  - `Backend/src/core/auth/auth.service.js`

### Recommended UX
- Keep phone/OTP flow as is
- For new users, show name step plus optional referral code field
- If `ref` exists in URL/shared state, prefill it
- Store referral code in session storage during auth flow

### Frontend changes
- Update `SignIn.jsx`
  - continue reading `ref` from query params
  - preserve short code instead of ObjectId
- Update `OTP.jsx`
  - when `isNewUser`, show:
    - name input
    - optional referral code input
  - client-side validation:
    - trim spaces
    - uppercase code
    - length limit

### Validation UX
- Empty code is allowed
- Wrong code shows inline error
- Valid code can show helper success text before submit if validation endpoint is added

### Acceptance
- New user can signup without code
- New user can signup with valid code
- New user sees clean error for wrong code

## Phase 5: Backend Referral Validation And Reward Logic

### Objective
Make backend referral processing correct and safe.

### Current issue
`verifyUserOtpAndLogin` in `Backend/src/core/auth/auth.service.js` currently treats `ref` like an ObjectId.

### Required backend changes
- Accept short `referralCode`
- Resolve referrer by `referralCode`
- Validate all cases:
  - code exists
  - code is not own code
  - referred user is genuinely new/eligible
  - referred user has not already used another referral
  - referrer is active
  - referral settings are active
  - referrer has not exceeded `referralLimitUser`

### Suggested service extraction
- Create dedicated service, for example:
  - `Backend/src/modules/food/user/services/applyUserReferral.service.js`
- Keep auth login method smaller by moving referral business logic out of auth service

### Suggested validation responses
- `invalid_referral_code`
- `self_referral_not_allowed`
- `referral_limit_reached`
- `referral_disabled`
- `referral_already_used`
- `referrer_not_active`

### Important behavior decision
- Reward trigger:
  - option A: on signup completion
  - option B: on first order completion

### Recommendation
Use option A for now because current code is already closest to signup completion.

### Acceptance
- Backend accepts short codes
- Invalid/wrong/self codes are safely blocked
- Login never fails because of non-critical referral logging errors

## Phase 6: Wallet And Referral History Accuracy

### Objective
Make both financial reward entries and audit history clear.

### Current state
- Wallet helper can credit referral reward
- Referral details API already returns invited friends list

### Improvements
- Ensure wallet transaction metadata includes:
  - `source: referral_reward`
  - `side: referrer` or `side: referred_user`
  - `referralCode`
  - `referralLogId`
- Consider extending `FoodReferralLog` to store:
  - `referrerRewardAmount`
  - `referredUserRewardAmount`
  - `referralCodeUsed`
  - `creditedAt`

### Why this helps
- Cleaner audit trail
- Easier admin reporting
- Easier customer wallet history display

### Acceptance
- Referrer wallet shows correct credit entry
- Referred user wallet shows correct bonus entry
- Referral history reflects success/rejection reason

## Phase 7: Refer & Earn Page Improvements

### Objective
Make the user-facing referral page complete.

### Frontend changes
- Update `Frontend/src/modules/Food/pages/user/profile/ReferEarn.jsx`
  - show short `referralCode`
  - add copy code button
  - generate share link using referral code, not `_id`
  - optionally show referred-user reward too
  - keep invite stats/history

### Share link format
- Preferred:
  - `${window.location.origin}/refer/${referralCode}`
- Alternate:
  - `${window.location.origin}/food/user/auth/login?ref=${referralCode}`

### Acceptance
- User can copy code directly
- User shares clean referral link
- Recipient sees proper landing page or login flow

## Phase 8: Data Integrity And Transaction Safety

### Objective
Avoid partial updates where wallet, log, and count fall out of sync.

### Recommendation
- Use Mongo transaction/session around:
  - setting `referredBy`
  - creating referral log
  - incrementing `referralCount`
  - crediting referrer wallet
  - crediting referred user wallet

### Fallback
If transaction support is not practical right now:
- make logic idempotent
- ensure duplicate reward credit is impossible
- keep unique constraint per referee in referral log

### Acceptance
- Same referral cannot be credited twice
- Partial failure does not create duplicate credits

## API Proposal

## Existing APIs to keep
- `GET /food/admin/referral-settings`
- `PUT /food/admin/referral-settings`
- `GET /food/user/referrals/stats`
- `GET /food/user/referrals/details`
- `GET /food/landing/referral-settings`

## Suggested new APIs

### Validate referral code
`GET /food/auth/referral/validate/:code`

Response example:

```json
{
  "success": true,
  "message": "Referral code is valid",
  "data": {
    "valid": true,
    "referralCode": "ABX92K",
    "referrerName": "Rahul",
    "referrerReward": 100,
    "referredUserReward": 50
  }
}
```

### Invalid code response

```json
{
  "success": false,
  "message": "Invalid referral code",
  "errorCode": "invalid_referral_code"
}
```

## Admin settings payload

```json
{
  "referralRewardUser": 100,
  "referralRewardReferredUser": 50,
  "referralLimitUser": 25,
  "isActive": true
}
```

## Auth verify payload
Current flow can continue using:

```json
{
  "phone": "9876543210",
  "otp": "1234",
  "name": "Aditi",
  "ref": "ABX92K",
  "platform": "web"
}
```

## Validation Rules

### Client-side
- Referral code input:
  - optional
  - trim spaces
  - uppercase automatically
  - max length 8 or whatever backend standardizes

### Server-side
- Code must exist
- Code must belong to an active user
- User cannot apply own code
- Existing user cannot re-claim signup referral
- Limit check must happen before reward credit
- Rewards of `0` should not create misleading success messaging

## Suggested Work Breakdown

## Backend
1. Add short referral code generator and unique handling
2. Add migration/backfill for old users
3. Refactor referral processing out of `auth.service.js`
4. Resolve referral by code instead of ObjectId
5. Add validation endpoint for referral code
6. Improve referral log schema if needed
7. Wrap reward credit flow in transaction/idempotent guard

## Frontend
1. Update admin referral settings UI for limit and active state
2. Update Refer & Earn page to display short code and new share link
3. Add referral landing page
4. Add optional referral code field in signup/new-user flow
5. Add inline success/error handling for referral code
6. Verify referral history and wallet copy reflect actual reward events

## Testing Checklist

### Positive cases
- New user signs up with valid code
- New user signs up without code
- Referrer gets configured reward
- Referred user gets configured reward
- Wallet history updates on both sides
- Referral stats/details update correctly

### Negative cases
- Wrong referral code
- Self referral
- Same user tries second referral
- Referrer limit reached
- Referral program inactive
- Referrer reward `0`
- Referred reward `0`

### Regression checks
- Existing user login still works
- OTP flow still works without referral
- Admin settings page still saves normally
- Refer page still loads if no rewards are configured

## Risks
- Existing users currently may have `referralCode = _id`, so migration is important
- If reward credit happens inside auth without transaction safety, duplicate/partial credits are possible
- If signup flow mixes login and registration too tightly, UX can get confusing unless new-user step is explicit

## Recommended Implementation Order
1. Backend short referral codes
2. Backend validation/reward refactor
3. Admin settings UI completion
4. Refer & Earn page share-link fix
5. Public referral landing page
6. Signup optional referral code UX
7. Wallet/history polish
8. Full end-to-end test

## Definition Of Done
- Admin can configure rewards and referral limit
- Customer shares short referral code/link
- Shared link opens referral landing page
- New user can optionally apply code in signup
- Wrong/self/invalid codes are rejected with clear errors
- Referrer and referred user rewards are credited correctly
- Wallet and referral history show the rewards
- Duplicate referral credits are prevented
