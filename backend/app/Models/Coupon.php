<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Coupon extends Model
{
    protected $guarded = [];

    protected function casts(): array
    {
        return ['value' => 'decimal:2', 'min_order_amount' => 'decimal:2', 'expires_at' => 'datetime', 'is_active' => 'boolean'];
    }

    public function store()
    {
        return $this->belongsTo(Store::class);
    }
}
