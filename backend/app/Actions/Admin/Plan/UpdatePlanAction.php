<?php

namespace App\Actions\Admin\Plan;

use App\DTOs\Admin\Plan\PlanData;
use App\Models\Plan;

class UpdatePlanAction
{
    public function execute(Plan $plan, PlanData $data): Plan
    {
        $plan->update($data->attributes);

        return $plan;
    }
}