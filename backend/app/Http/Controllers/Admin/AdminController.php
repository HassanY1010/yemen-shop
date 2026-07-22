<?php

namespace App\Http\Controllers\Admin;

use App\Actions\Admin\Plan\CreatePlanAction;
use App\Actions\Admin\Plan\DeletePlanAction;
use App\Actions\Admin\Plan\UpdatePlanAction;
use App\Actions\Admin\Store\ExtendStoreSubscriptionAction;
use App\Actions\Admin\Store\UpdateStorePlanAction;
use App\Actions\Admin\Store\UpdateStoreStatusAction;
use App\Actions\Admin\User\UpdateUserStatusAction;
use App\DTOs\Admin\Plan\PlanData;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\Plan\StorePlanRequest;
use App\Http\Requests\Admin\Plan\UpdatePlanRequest;
use App\Http\Requests\Admin\Store\UpdateStorePlanRequest;
use App\Http\Requests\Admin\Store\UpdateStoreStatusRequest;
use App\Http\Requests\Admin\User\UpdateUserStatusRequest;
use App\Models\Order;
use App\Models\Plan;
use App\Models\Store;
use App\Models\User;
use Illuminate\Http\Request;

class AdminController extends Controller
{
    public function overview()
    {
        return response()->json([
            'stats' => [
                'stores' => Store::count(),
                'active_stores' => Store::where('status', 'active')->count(),
                'users' => User::count(),
                'orders' => Order::count(),
                'revenue' => Order::sum('total'),
            ],
            'recent_stores' => Store::with('owner', 'plan')->latest()->limit(5)->get(),
            'recent_orders' => Order::with('store')->latest()->limit(5)->get(),
        ]);
    }

    public function stores(Request $request)
    {
        $query = Store::query()->with('owner', 'plan')->withCount(['products', 'orders', 'customers']);
        $query->when($request->query('status') && $request->query('status') !== 'all', fn ($q) => $q->where('status', $request->query('status')));
        $query->when($request->query('search'), fn ($q, $search) => $q->where(fn ($inner) => $inner->where('name', 'like', "%$search%")->orWhere('slug', 'like', "%$search%")));

        return response()->json($query->latest()->paginate((int) $request->query('limit', 20)));
    }

    public function showStore(int $id)
    {
        $store = Store::query()->with(['owner', 'plan'])->withCount(['products', 'orders', 'customers'])->findOrFail($id);

        return response()->json([
            'store' => $store,
            'recent_orders' => $store->orders()->latest()->limit(10)->get(),
            'stats' => [
                'revenue' => $store->orders()->where('status', '!=', 'cancelled')->sum('total'),
                'orders' => $store->orders()->count(),
                'active_products' => $store->products()->where('status', 'active')->count(),
                'customers' => $store->customers()->count(),
            ],
        ]);
    }

    public function updateStoreStatus(UpdateStoreStatusRequest $request, UpdateStoreStatusAction $action, int $id)
    {
        return response()->json($action->execute(Store::query()->findOrFail($id), $request->validated('status')));
    }

    public function updateStorePlan(UpdateStorePlanRequest $request, UpdateStorePlanAction $action, int $id)
    {
        return response()->json($action->execute(Store::query()->findOrFail($id), (int) $request->validated('plan_id')));
    }

    public function extendStore(ExtendStoreSubscriptionAction $action, int $id)
    {
        return response()->json($action->execute(Store::query()->findOrFail($id)));
    }

    public function users(Request $request)
    {
        $query = User::query()->with('store:id,user_id,name,slug,status');
        $query->when($request->query('role') && $request->query('role') !== 'all', fn ($q) => $q->where('role', $request->query('role')));
        $query->when($request->query('search'), fn ($q, $search) => $q->where(fn ($inner) => $inner->where('name', 'like', "%$search%")->orWhere('email', 'like', "%$search%")));

        return response()->json($query->latest()->paginate((int) $request->query('limit', 20)));
    }

    public function updateUserStatus(UpdateUserStatusRequest $request, UpdateUserStatusAction $action, int $id)
    {
        return response()->json($action->execute(User::query()->findOrFail($id), (bool) $request->validated('is_active')));
    }

    public function plans(Request $request)
    {
        return response()->json(Plan::query()->withCount('stores')->orderBy('price')->paginate((int) $request->query('limit', 50)));
    }

    public function storePlan(StorePlanRequest $request, CreatePlanAction $action)
    {
        return response()->json($action->execute(PlanData::fromArray($request->validated())), 201);
    }

    public function updatePlan(UpdatePlanRequest $request, UpdatePlanAction $action, int $id)
    {
        return response()->json($action->execute(Plan::query()->findOrFail($id), PlanData::fromArray($request->validated())));
    }

    public function deletePlan(DeletePlanAction $action, int $id)
    {
        $action->execute(Plan::query()->findOrFail($id));

        return response()->json(['message' => 'Plan deleted']);
    }

    public function orders(Request $request)
    {
        $query = Order::query()->with('store:id,name,slug');
        $query->when($request->query('status') && $request->query('status') !== 'all', fn ($q) => $q->where('status', $request->query('status')));

        return response()->json($query->latest()->paginate((int) $request->query('limit', 20)));
    }

    public function subscriptions(Request $request)
    {
        $query = Store::query()->with(['owner', 'plan'])->whereNotNull('subscription_status');
        $query->when($request->query('status') && $request->query('status') !== 'all', fn ($q) => $q->where('subscription_status', $request->query('status')));

        return response()->json([
            'stores' => $query->latest()->paginate((int) $request->query('limit', 20)),
            'stats' => [
                'expiring_soon' => Store::whereNotNull('subscription_ends_at')->where('subscription_ends_at', '<=', now()->addDays(7))->where('subscription_status', 'active')->count(),
                'paid' => Store::whereHas('plan', fn ($q) => $q->where('price', '>', 0))->count(),
                'free' => Store::whereHas('plan', fn ($q) => $q->where('price', '=', 0))->count(),
            ],
        ]);
    }

    public function settings()
    {
        return response()->json([
            'platform' => [
                'name' => config('app.name'),
                'url' => config('app.url'),
                'support_email' => 'support@example.com',
                'currency' => 'SAR',
            ],
            'features' => [
                'multi_store' => true,
                'sanctum_api' => true,
                'subscriptions' => true,
            ],
        ]);
    }
}