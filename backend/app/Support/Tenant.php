<?php

namespace App\Support;

use App\Models\Store;
use App\Models\User;
use Illuminate\Support\Str;

class Tenant
{
    public static function storeFor(User $user): ?Store
    {
        if ($user->role === 'staff') {
            return Store::query()->whereKey($user->store_id)->first();
        }

        return $user->store()->first();
    }

    public static function slug(string $value, string $table, ?int $storeId = null, ?int $ignoreId = null): string
    {
        $base = Str::slug($value) ?: Str::random(8);
        $slug = $base;
        $i = 2;

        while (true) {
            $query = \DB::table($table)->where('slug', $slug);
            if ($storeId) {
                $query->where('store_id', $storeId);
            }
            if ($ignoreId) {
                $query->where('id', '!=', $ignoreId);
            }
            if (! $query->exists()) {
                return $slug;
            }
            $slug = $base.'-'.$i++;
        }
    }

    public static function orderNumber(): string
    {
        return 'ORD-'.now()->format('Ymd').'-'.strtoupper(Str::random(6));
    }
}
