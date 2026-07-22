<?php

namespace App\Policies;

use App\Models\Category;
use App\Models\User;
use App\Policies\Concerns\AuthorizesStoreAccess;

class CategoryPolicy
{
    use AuthorizesStoreAccess;

    public function create(User $user, int $storeId): bool { return $this->canAccessStore($user, $storeId); }
    public function update(User $user, Category $category): bool { return $this->canAccessStore($user, $category->store_id); }
    public function delete(User $user, Category $category): bool { return $this->canAccessStore($user, $category->store_id); }
}