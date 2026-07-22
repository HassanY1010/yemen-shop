<?php

namespace App\Actions\Merchant\Order;

use App\Models\Store;
use Symfony\Component\HttpFoundation\Response;

class ExportOrdersAction
{
    public function execute(Store $store): Response
    {
        $orders = $store->orders()->latest()->get();
        $rows = [implode(',', ['order_number', 'customer_name', 'customer_email', 'customer_phone', 'subtotal', 'discount', 'total', 'status', 'payment_status', 'created_at'])];

        foreach ($orders as $order) {
            $rows[] = implode(',', array_map(
                fn ($value) => '"'.str_replace('"', '""', (string) $value).'"',
                [$order->order_number, $order->customer_name, $order->customer_email, $order->customer_phone, $order->subtotal, $order->discount_amount, $order->total, $order->status, $order->payment_status, $order->created_at],
            ));
        }

        return response("\xEF\xBB\xBF".implode("\n", $rows), 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="orders.csv"',
        ]);
    }
}