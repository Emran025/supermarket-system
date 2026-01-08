<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Role;
use App\Models\Module;
use App\Models\RolePermission;
use App\Services\PermissionService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class RolesController extends Controller
{
    use BaseApiController;

    public function index(Request $request): JsonResponse
    {
        PermissionService::requirePermission('settings', 'view');

        $action = $request->query('action');


        if (!$action) {
            $roles = Role::select('id', 'role_name_ar as name', 'role_key')
                ->orderBy('role_name_ar')
                ->get();
            return response()->json(['success' => true, 'roles' => $roles]);
        }
        
        if ($action === 'roles') {
            $roles = Role::orderBy('role_name_ar')->get();
            return response()->json(['success' => true, 'data' => $roles]);
        }

        if ($action === 'modules') {
            $modules = Module::orderBy('category')->orderBy('sort_order')->get();
            $grouped = $modules->groupBy('category');
            return response()->json(['success' => true, 'data' => $grouped]);
        }

        if ($action === 'role_permissions') {
            $roleId = $request->query('role_id');
            $permissions = RolePermission::where('role_id', $roleId)
                ->join('modules', 'role_permissions.module_id', '=', 'modules.id')
                ->select('role_permissions.*', 'modules.module_key')
                ->get();
            return response()->json(['success' => true, 'data' => $permissions]);
        }

        return $this->errorResponse('Invalid action');
    }

    public function store(Request $request): JsonResponse
    {
        PermissionService::requirePermission('settings', 'create');

        $action = $request->query('action');

        if ($action === 'update_permissions') {
            $validated = $request->validate([
                'role_id' => 'required|exists:roles,id',
                'permissions' => 'required|array',
                'permissions.*.module_id' => 'required|exists:modules,id',
                'permissions.*.can_view' => 'required|integer|in:0,1',
                'permissions.*.can_create' => 'required|integer|in:0,1',
                'permissions.*.can_edit' => 'required|integer|in:0,1',
                'permissions.*.can_delete' => 'required|integer|in:0,1',
            ]);

            foreach ($validated['permissions'] as $perm) {
                RolePermission::updateOrCreate(
                    ['role_id' => $validated['role_id'], 'module_id' => $perm['module_id']],
                    [
                        'can_view' => (bool)$perm['can_view'],
                        'can_create' => (bool)$perm['can_create'],
                        'can_edit' => (bool)$perm['can_edit'],
                        'can_delete' => (bool)$perm['can_delete'],
                        'created_by' => auth()->id()
                    ]
                );
            }

            return $this->successResponse([], 'Permissions updated');
        }

        // Default: Create role
        $validated = $request->validate([
            'name' => 'required|string|max:100',
            'description' => 'nullable|string',
        ]);

        $role = Role::create([
            'role_key' => \Illuminate\Support\Str::slug($validated['name']),
            'role_name_ar' => $validated['name'],
            'role_name_en' => $validated['name'], // Fallback
            'description' => $validated['description'],
            'is_system' => false,
            'is_active' => true,
            'created_by' => auth()->id()
        ]);

        return $this->successResponse(['id' => $role->id], 'Role created');
    }

    public function destroy($id): JsonResponse
    {
        PermissionService::requirePermission('settings', 'delete');

        $role = Role::findOrFail($id);
        
        if ($role->is_system) {
            return $this->errorResponse('Cannot delete system role', 403);
        }

        if ($role->users()->exists()) {
            return $this->errorResponse('Cannot delete role with assigned users', 422);
        }

        $role->delete();

        return $this->successResponse([], 'Role deleted');
    }
}
