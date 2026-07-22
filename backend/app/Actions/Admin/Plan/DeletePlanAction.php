<?php

namespace App\Actions\Admin\Plan;

use App\Models\Plan;

class DeletePlanAction
{
    public function execute(Plan $plan): void
    {
        $plan->loadCount('stores');
        abort_if($plan->stores_count > 0, 422, 'Plan has stores.');

        $plan->delete();
    }
}