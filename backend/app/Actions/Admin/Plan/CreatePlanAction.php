<?php

namespace App\Actions\Admin\Plan;

use App\DTOs\Admin\Plan\PlanData;
use App\Models\Plan;

class CreatePlanAction
{
    public function execute(PlanData $data): Plan
    {
        return Plan::query()->create($data->attributes);
    }
}