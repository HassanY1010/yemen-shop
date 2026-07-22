<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Store extends Model
{
    use HasFactory;

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'shipping_rates' => 'array',
            'subscription_ends_at' => 'datetime',
            'total_sales' => 'decimal:2',
        ];
    }

    public function owner()
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function user()
    {
        return $this->owner();
    }

    public function plan()
    {
        return $this->belongsTo(Plan::class);
    }

    public function products()
    {
        return $this->hasMany(Product::class);
    }

    public function categories()
    {
        return $this->hasMany(Category::class);
    }

    public function orders()
    {
        return $this->hasMany(Order::class);
    }

    public function customers()
    {
        return $this->hasMany(Customer::class);
    }

    public function coupons()
    {
        return $this->hasMany(Coupon::class);
    }

    public function staff()
    {
        return $this->hasMany(StoreStaff::class);
    }
}
