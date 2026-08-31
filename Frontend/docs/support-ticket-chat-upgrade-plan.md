# Support Ticket Chat Upgrade Plan

## Date
August 31, 2026

## Goal
Upgrade the current support ticket flow from:

- one ticket
- one issue description
- one `adminResponse`

into:

- one ticket
- many back-and-forth messages
- admin and customer/shop/delivery partner can both reply
- admin and ticket owner can both close or reopen the ticket

This should keep the current ticket flow mostly unchanged and only extend it into a proper conversation thread.

## Current State In Repo

### User support
- Model: `Backend/src/modules/food/user/models/supportTicket.model.js`
- Current fields:
  - `userId`
  - `type`
  - `orderId`
  - `shopId`
  - `issueType`
  - `description`
  - `status`
  - `adminResponse`

### Shop support
- Model: `Backend/src/modules/food/shop/models/supportTicket.model.js`
- Current fields:
  - `shopId`
  - `category`
  - `issueType`
  - `subject`
  - `description`
  - `orderRef`
  - `priority`
  - `status`
  - `adminResponse`

### Delivery support
- Model: `Backend/src/modules/food/delivery/models/supportTicket.model.js`
- Current fields:
  - `deliveryPartnerId`
  - `ticketId`
  - `subject`
  - `description`
  - `category`
  - `priority`
  - `status`
  - `adminResponse`
  - `respondedAt`

### Existing screens and routes
- User ticket flow already exists
- Shop ticket flow already exists
- Delivery ticket flow already exists
- Admin already has:
  - `SupportTickets.jsx`
  - `DeliverySupportTickets.jsx`
- Current flow is single-response, not chat history

## Recommended Approach

Keep the current ticket models and routes, and add a shared message collection.

This is the lowest-risk path because:

- current create-ticket flow stays the same
- current list pages stay mostly the same
- current status handling stays the same
- only the ticket detail/reply flow changes from one response to many messages

## Data Model Design

## 1. Keep ticket models

Do not replace the three current ticket models right now.

Keep:

- `FoodSupportTicket`
- `FoodShopSupportTicket`
- `DeliverySupportTicket`

Continue using them as the main ticket record.

## 2. Add a shared ticket message model

Create a new model, for example:

- `Backend/src/modules/food/shared/models/supportTicketMessage.model.js`

Suggested fields:

- `ticketId`
- `sourceType`
  - `user`
  - `shop`
  - `delivery`
- `senderType`
  - `admin`
  - `user`
  - `shop`
  - `delivery`
- `senderId`
- `message`
- `attachments`
  - optional for later
- `isSystemMessage`
- `createdAt`
- `updatedAt`

Suggested indexes:

- `{ ticketId: 1, sourceType: 1, createdAt: 1 }`
- `{ senderId: 1, senderType: 1, createdAt: -1 }`

## 3. Add summary fields to each ticket

Each ticket should keep summary values for list screens:

- `lastMessage`
- `lastMessageAt`
- `lastMessageSenderType`
- `closedAt`
- `closedBy`
- `closedByType`

Optional:

- `unreadCountAdmin`
- `unreadCountOwner`

If unread count feels too much for phase 1, skip it and add later.

## Message Rules

### First message
- On ticket creation, the current `description` should also become the first message in the thread.

### Replies
- Admin can add many replies.
- Ticket owner can add many replies.

### Closed ticket behavior
- Closed tickets should not accept new messages.
- Allow explicit `reopen`, then messaging continues.

### System messages
Add system messages when important actions happen:

- `Ticket created`
- `Ticket closed by admin`
- `Ticket closed by customer`
- `Ticket reopened by admin`
- `Ticket reopened by delivery partner`

This makes the chat thread clearer.

## Status Design

To stay close to the current setup, support these statuses:

- `open`
- `in-progress`
- `resolved`
- `closed`

Normalization note:

- user/shop currently use `in-progress`
- delivery currently uses `in_progress`

Recommendation:

- standardize everything to `in-progress`

If changing delivery status is risky, keep backend compatibility for both values during migration.

## API Plan

## User support APIs

Keep current:

- `POST /support/ticket`
- `GET /support/my-tickets`

Add:

- `GET /support/tickets/:id`
  - return ticket details and message history
- `POST /support/tickets/:id/messages`
  - add a new user message
- `PATCH /support/tickets/:id/status`
  - close, reopen, resolve

## Shop support APIs

Keep current:

- `POST /support/tickets`
- `GET /support/tickets`

Add:

- `GET /support/tickets/:id`
- `POST /support/tickets/:id/messages`
- `PATCH /support/tickets/:id/status`

## Delivery support APIs

Keep current:

- `POST /support-tickets`
- `GET /support-tickets`
- `GET /support-tickets/:id`

Add:

- `POST /support-tickets/:id/messages`
- `PATCH /support-tickets/:id/status`

## Admin support APIs

For user and shop:

- `GET /admin/food/support-tickets`
- `GET /admin/food/support-tickets/:id/messages`
- `POST /admin/food/support-tickets/:id/messages`
- `PATCH /admin/food/support-tickets/:id/status`

For delivery:

- `GET /admin/food/delivery/support-tickets`
- `GET /admin/food/delivery/support-tickets/:id/messages`
- `POST /admin/food/delivery/support-tickets/:id/messages`
- `PATCH /admin/food/delivery/support-tickets/:id/status`

## Backend Service Plan

Create shared service helpers so we do not duplicate message logic 3 times.

Suggested shared service files:

- `Backend/src/modules/food/shared/services/supportTicketMessage.service.js`
- `Backend/src/modules/food/shared/services/supportTicketThread.service.js`

Responsibilities:

- create first message on ticket creation
- fetch messages for a ticket
- append message to ticket thread
- update ticket summary fields
- block message send if ticket is closed
- create close/reopen system messages

## Controller Changes

### User
- Update `Backend/src/modules/food/user/controllers/supportTicket.controller.js`
- Keep create/list actions
- Add:
  - get ticket thread
  - send message
  - update ticket status

### Shop
- Update `Backend/src/modules/food/shop/controllers/supportTicket.controller.js`
- Keep create/list actions
- Add:
  - get ticket thread
  - send message
  - update ticket status

### Delivery
- Update `Backend/src/modules/food/delivery/controllers/delivery.controller.js`
- Keep create/list/detail actions
- Add:
  - send message
  - update status with close/reopen support

### Admin
- Update admin controllers and services for:
  - list thread messages
  - send admin reply as a thread message
  - close/reopen ticket

## Frontend Plan

## 1. Keep ticket list pages mostly same

List pages should continue to show:

- ticket id
- subject or issue
- status
- created date

Add:

- last message preview
- last message time
- optional unread badge later

## 2. Replace one response UI with chat thread UI

Current screens that show only `adminResponse` should change into a conversation panel.

For example:

- user complaint/ticket detail
- shop support detail
- delivery support detail
- admin ticket modal/detail

UI structure:

- top section:
  - ticket id
  - subject
  - status
  - close/reopen button
- middle section:
  - full message history
  - admin messages on one side
  - owner messages on the other side
  - system messages centered
- bottom section:
  - text area
  - send button

## 3. Keep create-ticket flow same

Do not redesign submit forms right now.

When user/shop/delivery creates a ticket:

- existing subject/description form remains
- backend creates ticket
- backend also inserts first message from the description

## 4. Close and reopen actions

Both admin and ticket owner should be able to:

- close ticket
- reopen ticket if needed

Frontend rules:

- if closed, disable message input
- show `Reopen Ticket` button

## Notification Plan

Use the existing notification style already present in admin service.

Trigger notifications on:

- new admin message
- new owner message
- ticket closed
- ticket reopened

Payload suggestion:

- `type: support_ticket_message`
- `ticketId`
- `sourceType`
- `status`
- `senderType`

## Migration Plan

## Phase 1
- Add new message model
- Add summary fields to ticket models
- Keep `adminResponse` for temporary backward compatibility

## Phase 2
- On new ticket creation, also create first thread message
- On admin reply, create thread message instead of relying only on `adminResponse`

## Phase 3
- Update frontend admin detail view to load message history
- Update user support detail view to show chat

## Phase 4
- Reuse same thread UI and service flow for shop and delivery

## Phase 5
- Remove dependency on `adminResponse` in UI
- Keep field in DB for old tickets if needed

## Backward Compatibility

Old tickets may have:

- `description`
- `adminResponse`
- no thread messages

When opening an old ticket:

- show `description` as first message if no thread exists
- show `adminResponse` as admin message if no admin thread messages exist

This avoids breaking old records.

## Validation Rules

- Only ticket owner can send owner-side messages
- Only admin can send admin-side messages
- Only ticket owner or admin can close/reopen
- Empty messages are rejected
- Very long messages should be capped
- Closed ticket cannot receive new messages unless reopened

## Risks

- Status naming mismatch between delivery and user/shop
- Admin and owner permissions must be checked carefully
- Old tickets without messages need fallback mapping
- If unread counts are added now, the implementation becomes larger

## Recommendation

Implement in this order:

1. Shared message model and shared backend message service
2. User support ticket thread
3. Admin support ticket thread for user tickets
4. Shop support thread
5. Delivery support thread
6. Notifications
7. Unread counts and attachments later

## Acceptance Criteria

- Ticket creation flow still works as before
- Each ticket can contain many messages
- Admin can reply many times
- User/shop/delivery can reply many times
- Admin can close ticket
- Ticket owner can close ticket
- Closed tickets cannot receive new messages
- Reopened tickets can continue conversation
- Old tickets still open without crashing
