<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Product extends Model
{
    use HasFactory;

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'price' => 'decimal:2', 'sale_price' => 'decimal:2', 'weight' => 'decimal:2',
            'manage_stock' => 'boolean', 'featured' => 'boolean', 'tags' => 'array',
        ];
    }

    public function store()
    {
        return $this->belongsTo(Store::class);
    }

    public function category()
    {
        return $this->belongsTo(Category::class);
    }

    public function images()
    {
        return $this->hasMany(ProductImage::class)->orderByDesc('is_primary')->orderBy('sort_order');
    }

    public function variants()
    {
        return $this->hasMany(ProductVariant::class)->orderBy('type')->orderBy('sort_order');
    }

    public function reviews()
    {
        return $this->hasMany(ProductReview::class);
    }
}
