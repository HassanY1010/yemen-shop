<?php

namespace App\Actions\Merchant\Order;

use App\Models\Order;

class UpdateOrderStatusAction
{
    public function execute(Order $order, string $status): Order
    {
        $order->update(['status' => $status]);

        return $order;
    }
}