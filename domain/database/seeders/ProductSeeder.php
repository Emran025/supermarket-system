<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Product;
use Illuminate\Support\Facades\DB;

class ProductSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Don't re-seed if products exist
        if (Product::count() > 0) {
            return;
        }

        $adminUserId = DB::table('users')->where('role', 'admin')->value('id') ?? 1;

        // Fetch categories to map names to IDs
        $categories = \App\Models\Category::pluck('id', 'name');

        $products = [
            [
                'name' => 'أرز بسمتي 10 كجم',
                'description' => 'أرز بسمتي درجة أولى',
                'category_id' => $categories['المواد الغذائية'] ?? null,
                'unit_price' => 75.00,
                'minimum_profit_margin' => 10.00,
                'stock_quantity' => 100,
                'unit_name' => 'كيس',
                'items_per_unit' => 1,
                'sub_unit_name' => null,
                'weighted_average_cost' => 60.00,
                'created_by' => $adminUserId,
            ],
            [
                'name' => 'سكر ناعم 5 كجم',
                'description' => 'سكر أبيض ناعم',
                'category_id' => $categories['المواد الغذائية'] ?? null,
                'unit_price' => 18.50,
                'minimum_profit_margin' => 15.00,
                'stock_quantity' => 200,
                'unit_name' => 'كيس',
                'items_per_unit' => 1,
                'sub_unit_name' => null,
                'weighted_average_cost' => 14.00,
                'created_by' => $adminUserId,
            ],
            [
                'name' => 'زيت طبخ 1.5 لتر',
                'description' => 'زيت نباتي للطبخ',
                'category_id' => $categories['الزيوت'] ?? null,
                'unit_price' => 12.00,
                'minimum_profit_margin' => 12.00,
                'stock_quantity' => 150,
                'unit_name' => 'عبوة',
                'items_per_unit' => 12,
                'sub_unit_name' => 'كرتون',
                'weighted_average_cost' => 9.50,
                'created_by' => $adminUserId,
            ],
            [
                'name' => 'حليب طويل الأجل 1 لتر',
                'description' => 'حليب كامل الدسم',
                'category_id' => $categories['الألبان'] ?? null,
                'unit_price' => 4.50,
                'minimum_profit_margin' => 5.00,
                'stock_quantity' => 500,
                'unit_name' => 'حبة',
                'items_per_unit' => 12,
                'sub_unit_name' => null,
                'weighted_average_cost' => 3.50,
                'created_by' => $adminUserId,
            ],
            [
                'name' => 'مكرونة 500 جرام',
                'description' => 'مكرونة فاخرة',
                'category_id' => $categories['المواد الغذائية'] ?? null,
                'unit_price' => 3.00,
                'minimum_profit_margin' => 20.00,
                'stock_quantity' => 300,
                'unit_name' => 'كيس',
                'items_per_unit' => 20,
                'sub_unit_name' => 'كرتون',
                'weighted_average_cost' => 2.00,
                'created_by' => $adminUserId,
            ],
            [
                'name' => 'شاي أسود 100 كيس',
                'description' => 'شاي أسود فرط',
                'category_id' => $categories['المشروبات الساخنة'] ?? null,
                'unit_price' => 15.00,
                'minimum_profit_margin' => 15.00,
                'stock_quantity' => 100,
                'unit_name' => 'علبة',
                'items_per_unit' => 1,
                'sub_unit_name' => null,
                'weighted_average_cost' => 11.00,
                'created_by' => $adminUserId,
            ],
             [
                'name' => 'قهوة عربية 500 جرام',
                'description' => 'قهوة عربية محمصة',
                'category_id' => $categories['المشروبات الساخنة'] ?? null,
                'unit_price' => 45.00,
                'minimum_profit_margin' => 25.00,
                'stock_quantity' => 50,
                'unit_name' => 'كيس',
                'items_per_unit' => 1,
                'sub_unit_name' => null,
                'weighted_average_cost' => 32.00,
                'created_by' => $adminUserId,
            ],
            [
                'name' => 'عصير برتقال 200 مل',
                'description' => 'عصير برتقال طبيعي',
                'category_id' => $categories['المشروبات الباردة'] ?? null,
                'unit_price' => 1.50,
                'minimum_profit_margin' => 10.00,
                'stock_quantity' => 1000,
                'unit_name' => 'علبة',
                'items_per_unit' => 30,
                'sub_unit_name' => 'كرتون',
                'weighted_average_cost' => 1.00,
                'created_by' => $adminUserId,
            ],
            [
                'name' => 'مناديل ورقية 200 منديل',
                'description' => 'مناديل وجه ناعمة',
                'category_id' => $categories['المنظفات والورقيات'] ?? null,
                'unit_price' => 3.50,
                'minimum_profit_margin' => 15.00,
                'stock_quantity' => 400,
                'unit_name' => 'علبة',
                'items_per_unit' => 1,
                'sub_unit_name' => null,
                'weighted_average_cost' => 2.50,
                'created_by' => $adminUserId,
            ],
            [
                'name' => 'صابون غسيل أطباق 1 لتر',
                'description' => 'سائل غسيل أطباق برائحة الليمون',
                'category_id' => $categories['المنظفات والورقيات'] ?? null,
                'unit_price' => 10.00,
                'minimum_profit_margin' => 18.00,
                'stock_quantity' => 120,
                'unit_name' => 'عبوة',
                'items_per_unit' => 12,
                'sub_unit_name' => 'كرتون',
                'weighted_average_cost' => 7.50,
                'created_by' => $adminUserId,
            ],
        ];

        foreach ($products as $product) {
            Product::create($product);
        }
    }
}
