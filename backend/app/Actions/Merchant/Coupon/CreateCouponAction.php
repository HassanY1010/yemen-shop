<?php

namespace App\Actions\Merchant\Coupon;

use App\DTOs\Merchant\Coupon\CouponData;
use App\Models\Coupon;
use App\Models\Store;

class CreateCouponAction
{
    public function execute(Store $store, CouponData $data): Coupon
    {
        $attributes = $data->attributes;
        $attributes['code'] = strtoupper($attributes['code']);

        return $store->coupons()->create($attributes);
    }
}