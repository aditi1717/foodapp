# Restaurant-Exclusive Delivery Boys and Manual/Auto Order Assignment Flow

## Objective
Enable restaurant-exclusive delivery partners and give restaurants direct control over assignment:
- Invite delivery partners into an exclusive restaurant fleet.
- Let delivery partners accept or reject exclusivity.
- Allow restaurants to manually assign active orders.
- Allow restaurants to trigger auto-assignment on demand.
- Ensure dispatch and available-order visibility strictly follow exclusivity rules.

## Scope
- Backend schema + APIs + dispatch filters.
- Restaurant and delivery-partner frontend experiences.
- Verification (automated + manual).

## Proposed Database Changes

### 1. Delivery Partner Schema Update
File: `Backend/src/modules/food/delivery-partner/models/deliveryPartner.model.js`

Add:

```js
associatedRestaurantId: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'FoodRestaurant',
  default: null,
  index: true
},
restaurantAssociationStatus: {
  type: String,
  enum: ['none', 'pending', 'associated'],
  default: 'none',
  index: true
}
```

### 2. Recommended Constraints
- Keep current global approval flow unchanged.
- Association fields only control exclusivity, not partner verification status.
- Add migration/backfill default for existing partners:
  - `associatedRestaurantId = null`
  - `restaurantAssociationStatus = 'none'`

## Proposed Backend API Changes

## 1) Restaurant Endpoints (`/food/restaurant/...`)

### GET `/food/restaurant/delivery-partners`
Purpose:
- List approved delivery partners relevant to the restaurant:
  - Pending invitations.
  - Fully associated exclusive partners.
- Support search on global approved partners (name/phone) to invite.

Response shape (recommended):
- `associated`: array of partners in `pending`/`associated` for this restaurant.
- `searchResults`: array for search query (approved + not blocked by another association).

### POST `/food/restaurant/delivery-partners/:partnerId/invite`
Purpose:
- Send exclusive invitation.

Behavior:
- Validate restaurant auth + partner eligibility.
- Set:
  - `associatedRestaurantId = restaurantId`
  - `restaurantAssociationStatus = 'pending'`
- Emit notification to partner.

Guards:
- Do not re-invite already associated to another restaurant.
- Idempotent response if same restaurant already has partner in `pending`.

### POST `/food/restaurant/orders/:orderId/assign-partner`
Purpose:
- Manual assignment to one exclusive driver.

Behavior:
- Validate order belongs to restaurant and is assignable.
- Validate partner is online, approved, and associated to this restaurant (`associated`).
- Update order dispatch:
  - `dispatch.status = 'assigned'`
  - `dispatch.deliveryPartnerId = partnerId`
- Emit socket + push notifications for accept/reject flow.

### POST `/food/restaurant/orders/:orderId/auto-assign`
Purpose:
- Manually trigger auto-dispatch logic.

Behavior:
- Validate order belongs to restaurant and is assignable.
- Invoke `tryAutoAssign(orderId)`.
- Return assignment attempt result.

## 2) Delivery Partner Endpoints (`/food/delivery/...`)

### GET `/food/delivery/restaurant-association`
Purpose:
- Return current association state:
  - Pending invitation details, or
  - Active associated restaurant details.

### POST `/food/delivery/restaurant-association/respond`
Payload:

```json
{ "action": "accept" }
```
or
```json
{ "action": "reject" }
```

Behavior:
- `accept`:
  - `restaurantAssociationStatus = 'associated'`
- `reject`:
  - `associatedRestaurantId = null`
  - `restaurantAssociationStatus = 'none'`
- Preserve global delivery partner profile/approval data.

## 3) Exclusivity Filters in Dispatch and Available Orders

### Dispatch Logic (`order-dispatch.service.js`)
Update partner discovery query (`listNearbyOnlineDeliveryPartners`) to include only:
- Global partners (`associatedRestaurantId = null`), OR
- Partners associated to ordering restaurant (`associatedRestaurantId == restaurantId`).

Outcome:
- Exclusive partners never receive auto-assigned orders from other restaurants.

### Available Orders List (`order-delivery.service.js`)
When listing unassigned orders for a delivery partner:
- If partner is `associated`:
  - show only unassigned orders for `associatedRestaurantId`.
- Else (global):
  - show global unassigned orders as current behavior.

## Proposed Frontend Changes

## 1) Restaurant Dashboard

### New Page: `/food/restaurant/delivery-partners`
- Premium card-based list of:
  - Active associated drivers.
  - Pending invites.
  - Online/offline state.
- Search input (name/phone) over eligible delivery partners.
- Invite CTA per search result.

### Active Orders / Order Details
Add controls:
- `Assign Delivery Boy`:
  - List online exclusive drivers.
  - Assign on click.
- `Assign Automatically`:
  - Calls auto-assign endpoint.

UX notes:
- Disable actions while request in-flight.
- Show success/error toasts with clear reasons.

## 2) Delivery Boy App

### Partnership Request Banner/Card
If pending invite exists, show:
- Restaurant name + basic details.
- Message explaining exclusivity impact.
- `Accept` and `Decline` actions.

If associated:
- Show `Partnered with [Restaurant Name]` state.
- Optional `Leave Partnership` action (if business permits; otherwise admin-only offboarding).

## Suggested Backend Implementation Sequence
1. Schema update + migration/backfill.
2. Restaurant invite/list endpoints.
3. Delivery partner association read/respond endpoints.
4. Manual assign + auto-assign trigger endpoints.
5. Dispatch and available-orders filtering.
6. Notifications (socket/push) integration.
7. Unit/integration tests.

## Suggested Frontend Implementation Sequence
1. Restaurant `delivery-partners` page.
2. Order details assignment controls.
3. Delivery partner pending invite/associated UI.
4. Error/loading states + polish.

## Verification Plan

## Automated Verification
- Unit tests:
  - Partner query filtering by association/global state.
  - Invite accept/reject transitions.
  - Manual assign validations.
  - Auto-assign trigger path.
- Integration tests:
  - Restaurant A exclusive partner cannot receive Restaurant B order.
  - Associated partner sees only associated restaurant available orders.
- Build/compile checks for backend and frontend.

## Manual Verification
1. Create and approve a new delivery partner from admin.
2. From restaurant panel, invite by phone/name.
3. In delivery app, verify invite card appears.
4. Accept invite.
5. Place order for different restaurant:
   - invited partner must not receive/see it.
6. Place order for invited restaurant:
   - manual assign should work.
   - auto-assign trigger should match correctly.
7. Reject flow test:
   - reject invite and verify partner returns to global pool.

## Edge Cases and Guardrails
- Prevent partner from being associated with multiple restaurants simultaneously.
- Handle re-invite after reject.
- Handle partner offline during manual assignment.
- Handle order already assigned/cancelled race conditions.
- Ensure idempotency on repeated invite/accept/assign requests.

## Deliverables
- Schema + migration patch.
- New/updated APIs and service-layer filters.
- Restaurant and delivery-partner UI updates.
- Tests and rollout verification notes.
