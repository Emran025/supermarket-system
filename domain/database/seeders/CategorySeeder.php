<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Category;
use Illuminate\Support\Facades\DB;

class CategorySeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Don't re-seed if categories exist
        if (Category::count() > 0) {
            return;
        }

        $adminUserId = DB::table('users')->where('role', 'admin')->value('id') ?? 1;

        $categories = [
            'المواد الغذائية',
            'الزيوت',
            'الألبان',
            'المشروبات الساخنة',
            'المشروبات الباردة',
            'المنظفات والورقيات',
        ];

        foreach ($categories as $categoryName) {
            Category::create([
                'name' => $categoryName,
                'created_by' => $adminUserId,
            ]);
        }
    }
}
