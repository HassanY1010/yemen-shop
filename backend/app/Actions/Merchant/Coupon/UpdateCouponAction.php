<?php

namespace App\Actions\Merchant\Coupon;

use App\DTOs\Merchant\Coupon\CouponData;
use App\Models\Coupon;

class UpdateCouponAction
{
    public function execute(Coupon $coupon, CouponData $data): Coupon
    {
        $attributes = $data->attributes;

        if (array_key_exists('code', $attributes)) {
            $attributes['code'] = strtoupper($attributes['code']);
        }

        $coupon->update($attributes);

        return $coupon;
    }
}