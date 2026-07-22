<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FlashSale extends Model
{
    protected $guarded = [];
    protected function casts(): array { return ['start_at' => 'datetime', 'end_at' => 'datetime', 'is_active' => 'boolean', 'discount_value' => 'decimal:2']; }
    public function product() { return $this->belongsTo(Product::class); }
}
