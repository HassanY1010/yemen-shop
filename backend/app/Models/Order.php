<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Order extends Model
{
    protected $guarded = [];

    protected function casts(): array
    {
        return ['subtotal' => 'decimal:2', 'discount' => 'decimal:2', 'discount_amount' => 'decimal:2', 'shipping' => 'decimal:2', 'tax' => 'decimal:2', 'total' => 'decimal:2'];
    }

    public function store()
    {
        return $this->belongsTo(Store::class);
    }

    public function customer()
    {
        return $this->belongsTo(Customer::class);
    }

    public function items()
    {
        return $this->hasMany(OrderItem::class);
    }
}
