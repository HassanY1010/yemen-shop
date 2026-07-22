<?php

namespace App\Http\Controllers\Customer;

use App\Actions\Customer\Auth\LoginCustomerAction;
use App\Actions\Customer\Auth\RegisterCustomerAction;
use App\Actions\Customer\Auth\ResolveCustomerFromTokenAction;
use App\Actions\Customer\Order\CreateOrderAction;
use App\Actions\Customer\Order\ResolveValidCouponAction;
use App\Actions\Customer\Profile\UpdateCustomerProfileAction;
use App\Actions\Customer\Review\CreateProductReviewAction;
use App\DTOs\Customer\Order\CheckoutData;
use App\Http\Controllers\Controller;
use App\Http\Requests\Customer\Auth\LoginCustomerRequest;
use App\Http\Requests\Customer\Auth\RegisterCustomerRequest;
use App\Http\Requests\Customer\Order\StoreOrderRequest;
use App\Http\Requests\Customer\Order\ValidateCouponRequest as CustomerValidateCouponRequest;
use App\Http\Requests\Customer\OrderTracking\TrackOrderRequest;
use App\Http\Requests\Customer\Profile\UpdateCustomerProfileRequest;
use App\Http\Requests\Customer\Review\StoreProductReviewRequest;
use App\Models\FlashSale;
use App\Models\ProductVariant;
use App\Models\Store;
use Illuminate\Http\Request;

class CustomerStoreController extends Controller
{
    private function activeStore(string $slug): Store
    {
        return Store::query()->with('plan')->where('slug', $slug)->where('status', 'active')->firstOrFail();
    }

    public function show(string $slug)
    {
        $store = $this->activeStore($slug)->load(['categories' => fn ($q) => $q->where('is_active', true)->orderBy('sort_order')]);
        $featured = $store->products()->with(['images', 'category'])->where('status', 'active')->where('featured', true)->latest()->limit(8)->get();

        return response()->json(['store' => $store, 'featured_products' => $featured]);
    }

    public function products(Request $request, string $slug)
    {
        $query = $this->activeStore($slug)
            ->products()
            ->with(['images', 'category', 'variants' => fn ($q) => $q->where('is_active', true)])
            ->where('status', 'active');

        $query->when($request->query('category'), fn ($q, $category) => $q->where('category_id', $category));
        $query->when($request->query('search'), fn ($q, $search) => $q->where(fn ($inner) => $inner->where('name', 'like', "%$search%")->orWhere('description', 'like', "%$search%")));

        return response()->json($query->orderByDesc('featured')->latest()->paginate((int) $request->query('limit', 12)));
    }

    public function product(string $slug, string $productSlug)
    {
        $product = $this->activeStore($slug)
            ->products()
            ->with(['images', 'category', 'variants' => fn ($q) => $q->where('is_active', true), 'reviews'])
            ->where('status', 'active')
            ->where(fn ($q) => $q->where('slug', $productSlug)->orWhere('id', $productSlug))
            ->firstOrFail();

        $product->increment('views');

        return response()->json($product);
    }

    public function categories(string $slug)
    {
        return response()->json($this->activeStore($slug)->categories()->where('is_active', true)->orderBy('sort_order')->get());
    }

    public function createOrder(StoreOrderRequest $request, CreateOrderAction $action, string $slug)
    {
        $order = $action->execute($this->activeStore($slug), CheckoutData::fromArray($request->validated()));

        return response()->json([
            'message' => 'Order created',
            'order_number' => $order->order_number,
            'order' => $order,
        ], 201);
    }

    public function validateCoupon(CustomerValidateCouponRequest $request, ResolveValidCouponAction $action, string $slug)
    {
        $store = $this->activeStore($slug);
        $coupon = $action->execute($store->id, $request->validated('code'), $request->validated('order_total'));
        $discount = $action->discount($coupon, $request->validated('order_total'));

        return response()->json(['valid' => true, 'id' => $coupon->id, 'discount' => $discount, 'type' => $coupon->type, 'value' => $coupon->value]);
    }

    public function registerCustomer(RegisterCustomerRequest $request, RegisterCustomerAction $action, string $slug)
    {
        return response()->json($action->execute($this->activeStore($slug), $request->validated()), 201);
    }

    public function loginCustomer(LoginCustomerRequest $request, LoginCustomerAction $action, string $slug)
    {
        return response()->json($action->execute($this->activeStore($slug), $request->validated('email'), $request->validated('password')));
    }

    public function customerMe(Request $request, ResolveCustomerFromTokenAction $action, string $slug)
    {
        return response()->json(['customer' => $action->execute($request, $this->activeStore($slug))]);
    }

    public function customerOrders(Request $request, ResolveCustomerFromTokenAction $action, string $slug)
    {
        $store = $this->activeStore($slug);
        $customer = $action->execute($request, $store);

        return response()->json($customer->orders()->with('items')->where('store_id', $store->id)->latest()->get());
    }

    public function updateCustomerProfile(UpdateCustomerProfileRequest $request, ResolveCustomerFromTokenAction $resolver, UpdateCustomerProfileAction $action, string $slug)
    {
        $customer = $resolver->execute($request, $this->activeStore($slug));

        return response()->json(['success' => true, 'customer' => $action->execute($customer, $request->validated())]);
    }

    public function trackOrder(TrackOrderRequest $request, string $slug)
    {
        $data = $request->validated();
        $query = $this->activeStore($slug)->orders()->with('items')->where('order_number', $data['order_number']);
        $query->when($data['phone'] ?? null, fn ($q, $phone) => $q->where('customer_phone', $phone));

        return response()->json($query->firstOrFail());
    }

    public function createReview(StoreProductReviewRequest $request, CreateProductReviewAction $action, string $slug, int $id)
    {
        $review = $action->execute($this->activeStore($slug), $id, $request->validated());

        return response()->json(['message' => 'Review added', 'review' => $review], 201);
    }

    public function publicFlashSale(int $productId)
    {
        return response()->json(FlashSale::query()
            ->where('product_id', $productId)
            ->where('is_active', true)
            ->where('start_at', '<=', now())
            ->where('end_at', '>=', now())
            ->where(fn ($q) => $q->whereNull('max_quantity')->orWhereColumn('sold_quantity', '<', 'max_quantity'))
            ->first());
    }

    public function publicVariants(int $productId)
    {
        return response()->json(ProductVariant::query()
            ->where('product_id', $productId)
            ->where('is_active', true)
            ->orderBy('type')
            ->orderBy('sort_order')
            ->get());
    }
}