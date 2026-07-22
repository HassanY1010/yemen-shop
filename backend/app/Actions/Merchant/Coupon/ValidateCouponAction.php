<?php

namespace App\Actions\Merchant\Coupon;

use App\Models\Coupon;
use App\Models\Store;

class ValidateCouponAction
{
    public function execute(Store $store, string $code, float $total): array
    {
        $coupon = $store->coupons()
            ->where('code', strtoupper(trim($code)))
            ->where('is_active', true)
            ->where(fn ($query) => $query->whereNull('expires_at')->orWhere('expires_at', '>', now()))
            ->where(fn ($query) => $query->whereNull('max_uses')->orWhereColumn('used_count', '<', 'max_uses'))
            ->firstOrFail();

        abort_if($total < (float) $coupon->min_order_amount, 422, 'Minimum order amount not reached.');

        return [
            'valid' => true,
            'coupon' => $coupon,
            'discount' => $this->discount($coupon, $total),
        ];
    }

    private function discount(Coupon $coupon, float $total): float
    {
        return $coupon->type === 'percentage'
            ? min($total, $total * $coupon->value / 100)
            : min($total, $coupon->value);
    }
}