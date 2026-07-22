<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Hash;

class Customer extends Model
{
    protected $guarded = [];
    protected $hidden = ['password'];

    protected function casts(): array
    {
        return ['total_spent' => 'decimal:2'];
    }

    public function setPasswordAttribute($value): void
    {
        $this->attributes['password'] = $value ? Hash::make($value) : null;
    }

    public function store()
    {
        return $this->belongsTo(Store::class);
    }

    public function orders()
    {
        return $this->hasMany(Order::class);
    }
}
