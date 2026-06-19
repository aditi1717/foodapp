import fs from 'fs';
import path from 'path';

const TARGET_DIRS = [
  'c:/Users/aditi/OneDrive/Desktop/company project/Food App/Frontend/src/modules/Food',
  'c:/Users/aditi/OneDrive/Desktop/company project/Food App/Frontend/src/app'
];

const REPLACEMENTS = [
  // 1. Specific file imports and component names
  { search: /restaurantsExportUtils/g, replace: 'shopsExportUtils' },
  { search: /RestaurantCard/g, replace: 'ShopCard' },
  { search: /RestaurantDishCard/g, replace: 'ShopDishCard' },
  { search: /RestaurantFoodCard/g, replace: 'ShopFoodCard' },
  { search: /RestaurantNavbar/g, replace: 'ShopNavbar' },
  { search: /restaurantIcons/g, replace: 'shopIcons' },
  { search: /useRestaurantBackNavigation/g, replace: 'useShopBackNavigation' },
  { search: /useRestaurantNotifications/g, replace: 'useShopNotifications' },
  { search: /RestaurantWithdrawal/g, replace: 'ShopWithdrawal' },
  { search: /RestaurantPayoutSettlement/g, replace: 'ShopPayoutSettlement' },
  { search: /RestaurantSettlementHistory/g, replace: 'ShopSettlementHistory' },
  { search: /DisbursementReportRestaurants/g, replace: 'DisbursementReportShops' },
  { search: /RestaurantReport/g, replace: 'ShopReport' },
  { search: /RestaurantVATReport/g, replace: 'ShopVATReport' },
  { search: /RestaurantWithdraws/g, replace: 'ShopWithdraws' },
  { search: /restaurantAvailability/g, replace: 'shopAvailability' },
  { search: /restaurantManagement/g, replace: 'shopManagement' },
  { search: /restaurantStorage/g, replace: 'shopStorage' },
  { search: /getRestaurantAvailabilityStatus/g, replace: 'getShopAvailabilityStatus' },

  // 2. Folder paths in imports
  { search: /components\/user\/restaurants/g, replace: 'components/user/shops' },
  { search: /components\/admin\/restaurants/g, replace: 'components/admin/shops' },
  { search: /components\/restaurant/g, replace: 'components/shop' },
  { search: /pages\/user\/restaurants/g, replace: 'pages/user/shops' },
  { search: /pages\/admin\/restaurants/g, replace: 'pages/admin/shops' },
  { search: /pages\/restaurant/g, replace: 'pages/shop' }, // in case imports have pages/restaurant

  // 3. AdminRouter and ShopRouter broken page imports
  { search: /@food\/pages\/admin\/shop\/RestaurantsList/g, replace: '@food/pages/admin/shop/ShopsList' },
  { search: /@food\/pages\/admin\/shop\/AddRestaurant/g, replace: '@food/pages/admin/shop/AddShop' },
  { search: /@food\/pages\/admin\/shop\/EditRestaurant/g, replace: '@food/pages/admin/shop/EditShop' },
  { search: /@food\/pages\/admin\/shop\/RestaurantCommission/g, replace: '@food/pages/admin/shop/ShopCommission' },
  { search: /@food\/pages\/admin\/shop\/RestaurantComplaints/g, replace: '@food/pages/admin/shop/ShopComplaints' },
  { search: /@food\/pages\/admin\/shop\/RestaurantReviews/g, replace: '@food/pages/admin/shop/ShopReviews' },
  { search: /@food\/pages\/admin\/shop\/RestaurantsBulkImport/g, replace: '@food/pages/admin/shop/ShopsBulkImport' },
  { search: /@food\/pages\/admin\/shop\/RestaurantsBulkExport/g, replace: '@food/pages/admin/shop/ShopsBulkExport' },

  { search: /@food\/pages\/shop\/RestaurantDetailsPage/g, replace: '@food/pages/shop/ShopDetailsPage' },
  { search: /@food\/pages\/shop\/EditRestaurantPage/g, replace: '@food/pages/shop/EditShopPage' },
  { search: /@food\/pages\/shop\/RestaurantConfigPage/g, replace: '@food/pages/shop/ShopConfigPage' },
  { search: /@food\/pages\/shop\/RestaurantProfile/g, replace: '@food/pages/shop/ShopProfile' },
  { search: /@food\/pages\/shop\/RestaurantStatus/g, replace: '@food/pages/shop/ShopStatus' },
  { search: /@food\/pages\/shop\/EditRestaurantAddress/g, replace: '@food/pages/shop/EditShopAddress' },
  { search: /@food\/pages\/shop\/RestaurantSupport/g, replace: '@food/pages/shop/ShopSupport' },

  // 4. Client route URLs in Link elements, navigate, and layouts
  { search: /\/admin\/food\/restaurants/g, replace: '/admin/food/shops' },
  { search: /\/admin\/food\/restaurant-report/g, replace: '/admin/food/shop-report' },
  { search: /\/admin\/food\/restaurant-vat-report/g, replace: '/admin/food/shop-vat-report' },
  { search: /\/food\/restaurant\//g, replace: '/food/shop/' },
  { search: /\/food\/restaurant"/g, replace: '/food/shop"' },
  { search: /\/food\/restaurant'/g, replace: '/food/shop\'' },
  { search: /\/food\/restaurant`/g, replace: '/food/shop`' },
  { search: /\/user\/restaurants\//g, replace: '/user/shops/' },
  { search: /\/food\/user\/restaurants\//g, replace: '/food/user/shops/' },
  { search: /to=\{\`\/restaurants\/\$\{restaurant\.slug\}\`\}/g, replace: 'to={`/shops/${restaurant.slug}`}' },
  { search: /to=\{\`\/restaurants\/\$\{restaurant\.slug || [^}]+\}\`\}/g, replace: match => match.replace('restaurants', 'shops') },
  { search: /\/restaurants\/\$\{/g, replace: '/shops/${' },
  
  // ShopRouter specific component names
  { search: /RestaurantOrdersPage/g, replace: 'ShopOrdersPage' },
  { search: /RestaurantDetailsPage/g, replace: 'ShopDetailsPage' },
  { search: /EditRestaurantPage/g, replace: 'EditShopPage' },
  { search: /RestaurantNotifications/g, replace: 'ShopNotifications' },
  { search: /RestaurantOnboarding/g, replace: 'ShopOnboarding' },
  { search: /RestaurantOffersPage/g, replace: 'ShopOffersPage' },
  { search: /RestaurantConfigPage/g, replace: 'ShopConfigPage' },
  { search: /RestaurantProfile/g, replace: 'ShopProfile' },
  { search: /RestaurantSubscriptions/g, replace: 'ShopSubscriptions' },
  { search: /RestaurantMySubscription/g, replace: 'ShopMySubscription' },
  { search: /RestaurantStatus/g, replace: 'ShopStatus' },
  { search: /EditRestaurantAddress/g, replace: 'EditShopAddress' },
  { search: /RestaurantSupport/g, replace: 'ShopSupport' },
  { search: /RestaurantRouter/g, replace: 'ShopRouter' },
  
  // 5. UserRouter route declarations (if any remain)
  { search: /element=\{\<Restaurants \/\>\}/g, replace: 'element={<Shops />}' },
  { search: /element=\{\<RestaurantDetails \/\>\}/g, replace: 'element={<ShopDetails />}' },

  // 6. Hook / variable names that are safe to rename
  { search: /RestaurantRouter/g, replace: 'ShopRouter' }
];

function processFile(filePath) {
  const ext = path.extname(filePath);
  if (ext !== '.jsx' && ext !== '.js' && ext !== '.tsx') return;

  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;

  REPLACEMENTS.forEach(({ search, replace }) => {
    content = content.replace(search, replace);
  });

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated: ${filePath}`);
  }
}

function walkDir(dir) {
  if (!fs.existsSync(dir)) return;
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      walkDir(filePath);
    } else {
      processFile(filePath);
    }
  });
}

console.log("Starting global import, component name, and route links rename...");
TARGET_DIRS.forEach(dir => {
  console.log(`Scanning: ${dir}`);
  walkDir(dir);
});
console.log("Replacement complete!");
