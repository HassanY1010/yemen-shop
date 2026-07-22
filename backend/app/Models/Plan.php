<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Plan extends Model
{
    use HasFactory;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['features' => 'array', 'is_active' => 'boolean', 'price' => 'decimal:2'];
    }

    public function stores()
    {
        return $this->hasMany(Store::class);
    }
}
