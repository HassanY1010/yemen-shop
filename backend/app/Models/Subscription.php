<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Subscription extends Model
{
    protected $guarded = [];
    protected function casts(): array { return ['starts_at' => 'datetime', 'ends_at' => 'datetime', 'trial_ends_at' => 'datetime', 'amount' => 'decimal:2']; }
}
