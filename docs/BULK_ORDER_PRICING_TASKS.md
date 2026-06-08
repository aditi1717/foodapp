# Bulk Order Pricing Tasks

This file turns the `doc.txt` feature spec into an implementation checklist for the Food App.

## Feature Rules

- Bulk order mode applies to the entire cart.
- Bulk orders require scheduled delivery.
- Bulk orders do not allow Cash on Delivery.
- Only items with bulk pricing enabled can remain in a bulk-order cart.
- Bulk order commission should use `bulkOrderCommission`, then fall back to subscription reduced commission if active, then `defaultCommission`.

## Backend Tasks

### 1. Food Model

- [x] Update `food.model.js`
- [x] Add `bulkOrderPricing.enabled`
- [x] Add `bulkOrderPricing.minQuantity`
- [x] Add `bulkOrderPricing.bulkPrice`
- [x] Add validation for minimum quantity and price values
- [ ] Verify backward compatibility for existing food documents

### 2. Restaurant Commission Model

- [x] Update `restaurantCommission.model.js`
- [x] Add `bulkOrderCommission.type`
- [x] Add `bulkOrderCommission.value`
- [ ] Keep fallback order as `bulkOrderCommission` -> subscription reduced commission -> `defaultCommission`

### 3. Order Model

- [x] Update `order.model.js`
- [x] Add `isBulkOrder` to order item schema
- [x] Add `bulkPrice` to order item schema
- [x] Add `bulkMinQuantity` to order item schema
- [x] Add `isBulkOrder` to main order schema
- [x] Add index for order-level `isBulkOrder`

### 4. Food Create and Update Services

- [x] Update food create service to accept `bulkOrderPricing`
- [x] Update food edit service to accept `bulkOrderPricing`
- [x] Expose `bulkOrderPricing` in admin food approval APIs

### 5. Order Service

- [x] Accept `isBulkOrder` in place-order payload
- [x] Reject bulk orders when `isScheduled` is not `true`
- [x] Reject bulk orders when payment method is `cash`
- [x] Apply `bulkPrice` when item bulk pricing is enabled and quantity meets `minQuantity`
- [x] Save bulk pricing snapshot fields in order items
- [x] Use `bulkOrderCommission` for bulk-order commission calculation
- [x] Fall back to subscription reduced commission when `bulkOrderCommission` is missing
- [x] Fall back to `defaultCommission` when neither bulk commission nor subscription reduced commission is available

## Frontend Tasks

### 6. Restaurant Panel Item Form

- [x] Update `ItemDetailsPage.jsx`
- [x] Add a "Bulk Order Pricing" section
- [x] Add toggle for enabling bulk pricing
- [x] Add `Minimum Quantity` input
- [x] Add `Bulk Price per unit` input
- [x] Send bulk pricing fields in create and update API calls
- [x] Support variant-wise bulk pricing when variants exist
- [x] Keep general bulk pricing only for non-variant items

### 7. Admin Food Approval

- [x] Update `FoodApproval.jsx`
- [x] Add `Bulk Price` column to the approval table
- [x] Show bulk price and minimum quantity when enabled
- [x] Show empty or dash state when disabled
- [x] Add bulk pricing details in the item detail modal
- [x] Show variant bulk pricing in a compact single-line table layout when variants exist
- [x] Fix rupee-symbol rendering issues in approval bulk pricing display

### 8. Admin Foods List

- [x] Update `FoodsList.jsx`
- [x] Add `Bulk Pricing` column or badge
- [x] Show whether bulk pricing is enabled for each food item
- [x] Show variant-aware bulk pricing summary when variants have bulk pricing

### 9. Admin Restaurant Commission

- [x] Update `RestaurantCommission.jsx`
- [x] Add `Bulk Order Commission` field in add and edit dialog
- [x] Mirror the same type and value structure as default commission
- [x] Show bulk order commission in the commission list table

### 10. User Cart Bulk Mode

- [x] Update `Cart.jsx`
- [x] Show `Bulk Order` badge or button on items with bulk pricing enabled
- [x] Enable the control only when quantity meets `minQuantity`
- [x] Show helper message when quantity is below threshold
- [x] Toggle entire cart into bulk mode when user activates bulk order
- [x] Remove items that do not support bulk pricing when bulk mode starts
- [x] Show warning toast when non-bulk items are removed
- [x] Prevent adding non-bulk items while bulk mode is active
- [x] Show active bulk mode banner in cart
- [x] Replace standard prices with bulk prices
- [x] Hide or disable immediate delivery
- [x] Force scheduled delivery selection
- [x] Hide or disable Cash on Delivery
- [x] Send `isBulkOrder: true` in place-order API request

### 11. Cart State and Pricing Logic

- [x] Store bulk-mode state at cart level
- [x] Recalculate totals using bulk prices
- [x] Revert to normal pricing when bulk mode is turned off
- [x] Restore normal delivery options when bulk mode is turned off
- [x] Restore normal payment options when bulk mode is turned off

## Testing Tasks

### 12. Verification

- [ ] Test create food API with bulk pricing fields
- [ ] Test update food API with bulk pricing fields
- [ ] Test admin food approval response includes bulk pricing
- [ ] Test saving and fetching bulk order commission
- [x] Test bulk order rejection when scheduled delivery is missing
- [x] Test bulk order rejection when payment method is `cash`
- [ ] Test cart badge disabled state below minimum quantity
- [ ] Test cart bulk mode activation at or above minimum quantity
- [ ] Test removal of non-bulk items from cart when bulk mode starts
- [x] Test order totals use bulk pricing correctly
- [ ] Test order commission uses bulk commission correctly

## Suggested Order

1. Update models
2. Update backend services
3. Update restaurant and admin forms
4. Update cart UI and cart rules
5. Update order placement logic
6. Run manual and API verification

## Current Status

Implemented so far:

- Food schema support for `bulkOrderPricing`
- Backend create and update handling for food bulk pricing
- Restaurant item form bulk pricing UI
- Variant-wise bulk pricing UI and payload handling for items with variants
- Restaurant menu serialization so saved bulk pricing returns during edit flow
- Admin food approval bulk pricing display
- Admin foods list bulk pricing display
- Compact variant-wise bulk pricing review layout in admin approval
- Rupee-symbol rendering cleanup for admin bulk pricing UI
- Restaurant commission backend support for `bulkOrderCommission`
- Restaurant commission admin UI support for create, edit, and list bulk commission values
- Order model support for bulk-order flags and bulk pricing snapshots
- Backend bulk-order validation, server-side bulk pricing, and commission fallback priority
- Cart-level bulk-order mode, bulk item badges, and checkout restrictions

Not implemented yet:

- Manual API and end-to-end verification

## Next Move

Recommended next step:

1. Build cart bulk-mode UI and checkout restrictions
2. Run manual/API verification for bulk-order placement and commission calculation
3. Confirm checkout behavior for scheduled-only and no-cash bulk orders

Why this order:

- Order validation should be enforced before cart UI exposes bulk checkout to users.
- Cart bulk mode should be the last step, once pricing and rules are already trustworthy.
