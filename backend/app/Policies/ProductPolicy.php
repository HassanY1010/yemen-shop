<?php

namespace App\Policies;

use App\Models\Product;
use App\Models\User;
use App\Policies\Concerns\AuthorizesStoreAccess;

class ProductPolicy
{
    use AuthorizesStoreAccess;

    public function view(User $user, Product $product): bool { return $this->canAccessStore($user, $product->store_id); }
    public function create(User $user, int $storeId): bool { return $this->canAccessStore($user, $storeId); }
    public function update(User $user, Product $product): bool { return $this->canAccessStore($user, $product->store_id); }
    public function delete(User $user, Product $product): bool { return $this->canAccessStore($user, $product->store_id); }
}