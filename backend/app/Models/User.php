<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    protected $fillable = ['store_id', 'name', 'email', 'phone', 'password', 'role', 'avatar', 'is_active'];

    protected $hidden = ['password', 'remember_token'];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'is_active' => 'boolean',
        ];
    }

    public function store()
    {
        return $this->hasOne(Store::class);
    }

    public function staffStore()
    {
        return $this->belongsTo(Store::class, 'store_id');
    }

    public function staffMemberships()
    {
        return $this->hasMany(StoreStaff::class);
    }

    public function isAdmin(): bool
    {
        return $this->role === 'admin';
    }

    public function isMerchant(): bool
    {
        return in_array($this->role, ['merchant', 'staff'], true);
    }
}
