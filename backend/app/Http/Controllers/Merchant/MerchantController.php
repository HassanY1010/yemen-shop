<?php

namespace App\Http\Controllers\Merchant;

use App\Actions\Merchant\Category\CreateCategoryAction;
use App\Actions\Merchant\Category\UpdateCategoryAction;
use App\Actions\Merchant\Coupon\CreateCouponAction;
use App\Actions\Merchant\Coupon\UpdateCouponAction;
use App\Actions\Merchant\Coupon\ValidateCouponAction;
use App\Actions\Merchant\FlashSale\CreateFlashSaleAction;
use App\Actions\Merchant\FlashSale\UpdateFlashSaleAction;
use App\Actions\Merchant\Order\ExportOrdersAction;
use App\Actions\Merchant\Order\UpdateOrderStatusAction;
use App\Actions\Merchant\Product\CreateProductAction;
use App\Actions\Merchant\Product\UpdateProductAction;
use App\Actions\Merchant\Profile\UpdatePasswordAction;
use App\Actions\Merchant\Profile\UpdateProfileAction;
use App\Actions\Merchant\Staff\CreateStaffAction;
use App\Actions\Merchant\Staff\DeleteStaffAction;
use App\Actions\Merchant\Staff\UpdateStaffAction;
use App\Actions\Merchant\Store\UpdateStoreSettingsAction;
use App\Actions\Merchant\Subscription\SubscribeStoreAction;
use App\Actions\Merchant\Variant\SyncProductVariantsAction;
use App\Actions\Shared\UploadFileAction;
use App\DTOs\Merchant\Category\CategoryData;
use App\DTOs\Merchant\Coupon\CouponData;
use App\DTOs\Merchant\FlashSale\FlashSaleData;
use App\DTOs\Merchant\Product\ProductData;
use App\DTOs\Merchant\Staff\StaffData;
use App\DTOs\Merchant\Store\StoreSettingsData;
use App\DTOs\Merchant\Variant\ProductVariantsData;
use App\Http\Controllers\Controller;
use App\Http\Requests\Merchant\Category\StoreCategoryRequest;
use App\Http\Requests\Merchant\Category\UpdateCategoryRequest;
use App\Http\Requests\Merchant\Coupon\StoreCouponRequest;
use App\Http\Requests\Merchant\Coupon\UpdateCouponRequest;
use App\Http\Requests\Merchant\Coupon\ValidateCouponRequest;
use App\Http\Requests\Merchant\FlashSale\StoreFlashSaleRequest;
use App\Http\Requests\Merchant\FlashSale\UpdateFlashSaleRequest;
use App\Http\Requests\Merchant\Order\UpdateOrderStatusRequest;
use App\Http\Requests\Merchant\Product\StoreProductRequest;
use App\Http\Requests\Merchant\Product\UpdateProductRequest;
use App\Http\Requests\Merchant\Profile\UpdatePasswordRequest;
use App\Http\Requests\Merchant\Profile\UpdateProfileRequest;
use App\Http\Requests\Merchant\Staff\StoreStaffRequest;
use App\Http\Requests\Merchant\Staff\UpdateStaffRequest;
use App\Http\Requests\Merchant\Store\UpdateStoreSettingsRequest;
use App\Http\Requests\Merchant\Subscription\SubscribeRequest;
use App\Http\Requests\Merchant\Variant\SyncProductVariantsRequest;
use App\Http\Requests\Shared\UploadFileRequest;
use App\Models\FlashSale;
use App\Models\Plan;
use App\Models\ProductVariant;
use App\Support\Tenant;
use Illuminate\Http\Request;

class MerchantController extends Controller
{
    private function store(Request $request)
    {
        $store = Tenant::storeFor($request->user());
        abort_unless($store, 404, 'Store not found');

        return $store;
    }

    public function overview(Request $request)
    {
        $store = $this->store($request);

        return response()->json([
            'store' => $store->load('plan'),
            'stats' => [
                'products' => $store->products()->where('status', '!=', 'deleted')->count(),
                'orders' => $store->orders()->count(),
                'customers' => $store->customers()->count(),
                'revenue' => $store->orders()->whereIn('status', ['processing', 'completed'])->sum('total'),
                'pending_orders' => $store->orders()->where('status', 'pending')->count(),
                'low_stock' => $store->products()->where('status', 'active')->where('stock', '<=', 5)->count(),
            ],
            'recent_orders' => $store->orders()->latest()->limit(5)->get(),
        ]);
    }

    public function products(Request $request)
    {
        $query = $this->store($request)->products()->with(['images', 'category'])->where('status', '!=', 'deleted');
        $query->when($request->query('status') && $request->query('status') !== 'all', fn ($q) => $q->where('status', $request->query('status')));
        $query->when($request->query('search'), fn ($q, $search) => $q->where(fn ($inner) => $inner->where('name', 'like', "%$search%")->orWhere('sku', 'like', "%$search%")));

        return response()->json($query->latest()->paginate((int) $request->query('limit', 20)));
    }

    public function storeProduct(StoreProductRequest $request, CreateProductAction $action)
    {
        $store = $this->store($request);
        $this->authorize('create', [\App\Models\Product::class, $store->id]);
        $product = $action->execute($store, ProductData::fromArray($request->validated(), []));

        return response()->json(['message' => 'Product created', 'product' => $product], 201);
    }

    public function showProduct(Request $request, int $id)
    {
        return response()->json($this->store($request)->products()->with(['images', 'category', 'variants'])->where('status', '!=', 'deleted')->findOrFail($id));
    }

    public function updateProduct(UpdateProductRequest $request, UpdateProductAction $action, int $id)
    {
        $store = $this->store($request);
        $existingProduct = $store->products()->findOrFail($id);
        $this->authorize('update', $existingProduct);
        $product = $action->execute($store, $existingProduct, ProductData::fromArray($request->validated()));

        return response()->json(['message' => 'Product updated', 'product' => $product]);
    }

    public function deleteProduct(Request $request, int $id)
    {
        $product = $this->store($request)->products()->findOrFail($id);
        $this->authorize('delete', $product);
        $product->update(['status' => 'deleted']);

        return response()->json(['message' => 'Product deleted']);
    }

    public function categories(Request $request)
    {
        return response()->json($this->store($request)->categories()->orderBy('sort_order')->paginate((int) $request->query('limit', 50)));
    }

    public function storeCategory(StoreCategoryRequest $request, CreateCategoryAction $action)
    {
        $store = $this->store($request);
        $this->authorize('create', [\App\Models\Category::class, $store->id]);

        return response()->json($action->execute($store, CategoryData::fromArray($request->validated())), 201);
    }

    public function updateCategory(UpdateCategoryRequest $request, UpdateCategoryAction $action, int $id)
    {
        $store = $this->store($request);

        $category = $store->categories()->findOrFail($id);
        $this->authorize('update', $category);

        return response()->json($action->execute($store, $category, CategoryData::fromArray($request->validated())));
    }

    public function deleteCategory(Request $request, int $id)
    {
        $category = $this->store($request)->categories()->findOrFail($id);
        $this->authorize('delete', $category);
        $category->update(['is_active' => false]);

        return response()->json(['message' => 'Category deleted']);
    }

    public function orders(Request $request)
    {
        $query = $this->store($request)->orders()->with('items');
        $query->when($request->query('status') && $request->query('status') !== 'all', fn ($q) => $q->where('status', $request->query('status')));
        $query->when($request->query('search'), fn ($q, $search) => $q->where(fn ($inner) => $inner->where('order_number', 'like', "%$search%")->orWhere('customer_name', 'like', "%$search%")));

        return response()->json($query->latest()->paginate((int) $request->query('limit', 20)));
    }

    public function updateOrderStatus(UpdateOrderStatusRequest $request, UpdateOrderStatusAction $action, int $id)
    {
        $order = $this->store($request)->orders()->findOrFail($id);
        $this->authorize('update', $order);
        $order = $action->execute($order, $request->validated('status'));

        return response()->json(['message' => 'Order status updated', 'order' => $order]);
    }

    public function exportOrders(Request $request, ExportOrdersAction $action)
    {
        return $action->execute($this->store($request));
    }

    public function showOrder(Request $request, int $id)
    {
        return response()->json($this->store($request)->orders()->with(['items.product', 'customer'])->findOrFail($id));
    }

    public function plans()
    {
        return response()->json(Plan::query()->where('is_active', true)->orderBy('price')->get());
    }

    public function validateCoupon(ValidateCouponRequest $request, ValidateCouponAction $action)
    {
        return response()->json($action->execute($this->store($request), $request->validated('code'), $request->total()));
    }

    public function customers(Request $request)
    {
        return response()->json($this->store($request)->customers()->latest()->paginate((int) $request->query('limit', 20)));
    }

    public function coupons(Request $request)
    {
        return response()->json($this->store($request)->coupons()->latest()->paginate((int) $request->query('limit', 50)));
    }

    public function storeCoupon(StoreCouponRequest $request, CreateCouponAction $action)
    {
        $store = $this->store($request);
        $this->authorize('create', [\App\Models\Coupon::class, $store->id]);

        return response()->json($action->execute($store, CouponData::fromArray($request->validated())), 201);
    }

    public function updateCoupon(UpdateCouponRequest $request, UpdateCouponAction $action, int $id)
    {
        $coupon = $this->store($request)->coupons()->findOrFail($id);
        $this->authorize('update', $coupon);

        return response()->json($action->execute($coupon, CouponData::fromArray($request->validated())));
    }

    public function deleteCoupon(Request $request, int $id)
    {
        $coupon = $this->store($request)->coupons()->findOrFail($id);
        $this->authorize('delete', $coupon);
        $coupon->delete();

        return response()->json(['message' => 'Coupon deleted']);
    }

    public function staff(Request $request)
    {
        return response()->json($this->store($request)->staff()->with('user:id,name,email,phone,role,is_active,created_at')->paginate(50));
    }

    public function storeStaff(StoreStaffRequest $request, CreateStaffAction $action)
    {
        $store = $this->store($request);
        $this->authorize('create', [\App\Models\StoreStaff::class, $store->id]);

        return response()->json($action->execute($store, StaffData::fromArray($request->validated())), 201);
    }

    public function updateStaff(UpdateStaffRequest $request, UpdateStaffAction $action, int $id)
    {
        $staff = $this->store($request)->staff()->findOrFail($id);
        $this->authorize('update', $staff);

        return response()->json($action->execute($staff, StaffData::fromArray($request->validated())));
    }

    public function deleteStaff(Request $request, DeleteStaffAction $action, int $id)
    {
        $staff = $this->store($request)->staff()->findOrFail($id);
        $this->authorize('delete', $staff);
        $action->execute($staff);

        return response()->json(['message' => 'Staff deleted']);
    }

    public function analytics(Request $request)
    {
        $store = $this->store($request);

        return response()->json([
            'sales_by_status' => $store->orders()->selectRaw('status, COUNT(*) as count, SUM(total) as total')->groupBy('status')->get(),
            'top_products' => $store->products()->orderByDesc('total_sold')->limit(10)->get(['id', 'name', 'total_sold', 'stock']),
        ]);
    }

    public function notifications(Request $request)
    {
        $store = $this->store($request);
        $items = [];
        $pending = $store->orders()->where('status', 'pending')->count();
        $low = $store->products()->where('status', 'active')->where('stock', '<=', 5)->count();

        if ($pending) $items[] = ['id' => 1, 'type' => 'order', 'read' => false, 'title' => "$pending pending orders"];
        if ($low) $items[] = ['id' => 2, 'type' => 'stock', 'read' => false, 'title' => "$low low stock products"];

        return response()->json(['items' => $items, 'total' => count($items)]);
    }

    public function readAllNotifications()
    {
        return response()->json(['message' => 'Notifications marked as read']);
    }

    public function stockAlerts(Request $request)
    {
        $products = $this->store($request)->products()->where('status', 'active')->where('stock', '<=', 5)->orderBy('stock')->limit(10)->get(['id', 'name', 'stock']);

        return response()->json(['count' => $products->count(), 'products' => $products]);
    }

    public function profile(Request $request)
    {
        return response()->json($request->user());
    }

    public function updateProfile(UpdateProfileRequest $request, UpdateProfileAction $action)
    {
        return response()->json($action->execute($request->user(), $request->validated()));
    }

    public function updatePassword(UpdatePasswordRequest $request, UpdatePasswordAction $action)
    {
        $action->execute($request->user(), $request->validated('current_password'), $request->validated('new_password'));

        return response()->json(['message' => 'Password updated']);
    }

    public function storeSettings(Request $request)
    {
        return response()->json($this->store($request)->load('plan'));
    }

    public function updateStoreSettings(UpdateStoreSettingsRequest $request, UpdateStoreSettingsAction $action)
    {
        $store = $this->store($request);
        $this->authorize('update', $store);

        return response()->json($action->execute($store, StoreSettingsData::fromArray($request->validated())));
    }

    public function upload(UploadFileRequest $request, UploadFileAction $action)
    {
        $this->store($request);

        return response()->json($action->execute($request->file('file')));
    }

    public function subscribe(SubscribeRequest $request, SubscribeStoreAction $action)
    {
        $currentStore = $this->store($request);
        $this->authorize('update', $currentStore);
        $store = $action->execute($currentStore, (int) $request->validated('plan_id'));

        return response()->json(['message' => 'Subscription updated', 'store' => $store]);
    }

    public function flashSales(Request $request)
    {
        $store = $this->store($request);

        return response()->json(FlashSale::query()->with(['product.images'])->where('store_id', $store->id)->latest()->paginate((int) $request->query('limit', 50)));
    }

    public function storeFlashSale(StoreFlashSaleRequest $request, CreateFlashSaleAction $action)
    {
        $store = $this->store($request);
        $this->authorize('update', $store);

        return response()->json($action->execute($store, FlashSaleData::fromArray($request->validated())), 201);
    }

    public function updateFlashSale(UpdateFlashSaleRequest $request, UpdateFlashSaleAction $action, int $id)
    {
        $store = $this->store($request);
        $sale = FlashSale::query()->where('store_id', $store->id)->findOrFail($id);

        return response()->json($action->execute($sale, FlashSaleData::fromArray($request->validated())));
    }

    public function deleteFlashSale(Request $request, int $id)
    {
        $store = $this->store($request);
        $this->authorize('update', $store);
        FlashSale::query()->where('store_id', $store->id)->findOrFail($id)->delete();

        return response()->json(['message' => 'Flash sale deleted']);
    }

    public function productVariants(Request $request, int $id)
    {
        $store = $this->store($request);
        $store->products()->findOrFail($id);

        return response()->json(ProductVariant::query()->where('store_id', $store->id)->where('product_id', $id)->where('is_active', true)->orderBy('type')->orderBy('sort_order')->get());
    }

    public function syncProductVariants(SyncProductVariantsRequest $request, SyncProductVariantsAction $action, int $id)
    {
        $store = $this->store($request);
        $store->products()->findOrFail($id);
        $variants = $action->execute($store, $id, ProductVariantsData::fromArray($request->validated()));

        return response()->json(['message' => 'Variants saved', 'variants' => $variants]);
    }
}