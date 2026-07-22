<?php

namespace App\Actions\Admin\Store;

use App\Models\Plan;
use App\Models\Store;
use App\Models\Subscription;

class UpdateStorePlanAction
{
    public function execute(Store $store, int $planId): Store
    {
        $plan = Plan::query()->findOrFail($planId);

        $store->update([
            'plan_id' => $plan->id,
            'subscription_status' => 'active',
        ]);

        Subscription::query()->create([
            'store_id' => $store->id,
            'plan_id' => $plan->id,
            'amount' => $plan->price,
            'ends_at' => now()->addMonth(),
        ]);

        return $store->load('plan');
    }
}