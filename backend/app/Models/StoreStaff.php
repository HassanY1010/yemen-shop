<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class StoreStaff extends Model
{
    protected $table = 'store_staff';
    protected $guarded = [];

    protected function casts(): array
    {
        return ['permissions' => 'array', 'is_active' => 'boolean'];
    }

    public function store()
    {
        return $this->belongsTo(Store::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
