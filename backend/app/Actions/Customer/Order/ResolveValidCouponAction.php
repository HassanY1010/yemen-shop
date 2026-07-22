<?php

namespace App\Actions\Customer\Order;

use App\Models\Coupon;

class ResolveValidCouponAction
{
    public function execute(int $storeId, string $code, float $total): Coupon
    {
        $coupon = Coupon::query()
            ->where('store_id', $storeId)
            ->where('code', strtoupper(trim($code)))
            ->where('is_active', true)
            ->where(fn ($query) => $query->whereNull('expires_at')->orWhere('expires_at', '>', now()))
            ->where(fn ($query) => $query->whereNull('max_uses')->orWhereColumn('used_count', '<', 'max_uses'))
            ->firstOrFail();

        abort_if($total < (float) $coupon->min_order_amount, 422, 'Minimum order amount not reached.');

        return $coupon;
    }

    public function discount(Coupon $coupon, float $total): float
    {
        return $coupon->type === 'percentage'
            ? min($total, $total * $coupon->value / 100)
            : min($total, $coupon->value);
    }
}