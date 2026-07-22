<?php

namespace App\Actions\Merchant\Subscription;

use App\Models\Plan;
use App\Models\Store;
use App\Models\Subscription;

class SubscribeStoreAction
{
    public function execute(Store $store, int $planId): Store
    {
        $plan = Plan::query()->where('is_active', true)->findOrFail($planId);
        $endsAt = now()->addMonth();

        $store->update([
            'plan_id' => $plan->id,
            'subscription_status' => 'active',
            'subscription_ends_at' => $endsAt,
        ]);

        Subscription::query()->create([
            'store_id' => $store->id,
            'plan_id' => $plan->id,
            'status' => 'active',
            'amount' => $plan->price,
            'ends_at' => $endsAt,
        ]);

        return $store->fresh('plan');
    }
}