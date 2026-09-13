<?php

namespace Database\Seeders;

use App\Models\Department;
use App\Models\User;
use App\Services\PermissionService;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        /** @var PermissionService $permissions */
        $permissions = app(PermissionService::class);

        $departmentDefs = [
            'Administrator' => [
                'description' => 'Full system access including user management',
                'flags' => [
                    'dashboard' => ['view' => true],
                    'inventory' => ['view' => true, 'edit' => true],
                    'stock-materials' => ['view' => true],
                    'office-materials' => ['view' => true],
                    'forecast' => ['view' => true],
                    'procurement' => [
                        'view' => true,
                        'edit' => true,
                        'dept_review' => true,
                        'check' => true,
                        'final_approve' => true,
                        'review' => true,
                    ],
                    'issuance' => ['view' => true, 'edit' => true, 'review' => true],
                    'reports' => ['view' => true],
                    'calendar' => ['view' => true, 'table' => true],
                    'activity-logs' => ['view' => true],
                    'users' => ['view' => true, 'manage' => true],
                ],
            ],
            'Branch Manager' => [
                'description' => 'Final approval of requisition slips',
                'flags' => [
                    'dashboard' => ['view' => true],
                    'inventory' => ['view' => true, 'edit' => true],
                    'stock-materials' => ['view' => true],
                    'office-materials' => ['view' => true],
                    'forecast' => ['view' => true],
                    'procurement' => ['view' => true, 'final_approve' => true],
                    'issuance' => ['view' => true, 'edit' => true, 'review' => true],
                    'reports' => ['view' => true],
                    'calendar' => ['view' => true, 'table' => true],
                ],
            ],
            'Department Manager' => [
                'description' => 'Department-head review of request slips',
                'flags' => [
                    'dashboard' => ['view' => true],
                    'inventory' => ['view' => true, 'edit' => true],
                    'stock-materials' => ['view' => true],
                    'office-materials' => ['view' => true],
                    'forecast' => ['view' => true],
                    'procurement' => ['view' => true, 'dept_review' => true],
                    'issuance' => ['view' => true, 'edit' => true, 'review' => true],
                    'reports' => ['view' => true],
                    'calendar' => ['view' => true, 'table' => true],
                ],
            ],
            'Procurement Staff' => [
                'description' => 'Checks requisition slips and prints approved RS forms',
                'flags' => [
                    'dashboard' => ['view' => true],
                    'inventory' => ['view' => true],
                    'stock-materials' => ['view' => true],
                    'office-materials' => ['view' => true],
                    'forecast' => ['view' => true],
                    'procurement' => ['view' => true, 'check' => true],
                    'calendar' => ['view' => true],
                ],
            ],
            'Inventory Clerk' => [
                'description' => 'End user who submits request slips',
                'flags' => [
                    'dashboard' => ['view' => true],
                    'inventory' => ['view' => true, 'edit' => true],
                    'stock-materials' => ['view' => true],
                    'office-materials' => ['view' => true],
                    'forecast' => ['view' => true],
                    'procurement' => ['view' => true, 'edit' => true],
                    'issuance' => ['view' => true, 'edit' => true],
                    'calendar' => ['view' => true, 'table' => true],
                ],
            ],
            'Warehouse Staff' => [
                'description' => 'View-only inventory access',
                'flags' => [
                    'dashboard' => ['view' => true],
                    'inventory' => ['view' => true],
                    'stock-materials' => ['view' => true],
                    'office-materials' => ['view' => true],
                ],
            ],
        ];

        $departments = [];

        foreach ($departmentDefs as $name => $def) {
            $department = Department::updateOrCreate(
                ['name' => $name],
                ['description' => $def['description']]
            );

            $permissions->syncDepartmentPermissions(
                $department,
                $permissions->permissionRowsFromFlags($def['flags'])
            );

            $departments[$name] = $department;
        }

        $defaultUsers = [
            [
                'username' => 'admin',
                'first_name' => 'System',
                'last_name' => 'Admin',
                'birthday' => '1990-01-01',
                'role' => 'Administrator',
                'department' => 'Administrator',
                'password' => 'password123',
            ],
            [
                'username' => 'branch_manager',
                'first_name' => 'Branch',
                'last_name' => 'Manager',
                'birthday' => '1988-03-15',
                'role' => 'Branch Manager',
                'department' => 'Branch Manager',
                'password' => 'password123',
            ],
            [
                'username' => 'dept_manager',
                'first_name' => 'Department',
                'last_name' => 'Manager',
                'birthday' => '1991-07-22',
                'role' => 'Department Head',
                'department' => 'Department Manager',
                'password' => 'password123',
            ],
            [
                'username' => 'procurement_staff',
                'first_name' => 'Leanna Mae',
                'last_name' => 'Domdom',
                'birthday' => '1994-04-12',
                'role' => 'Procurement Staff',
                'department' => 'Procurement Staff',
                'password' => 'password123',
            ],
            [
                'username' => 'inventory_clerk',
                'first_name' => 'Inventory',
                'last_name' => 'Clerk',
                'birthday' => '1995-11-08',
                'role' => 'Inventory Clerk',
                'department' => 'Inventory Clerk',
                'password' => 'password123',
            ],
            [
                'username' => 'warehouse_staff',
                'first_name' => 'Warehouse',
                'last_name' => 'Staff',
                'birthday' => '1998-05-30',
                'role' => 'Warehouse Staff',
                'department' => 'Warehouse Staff',
                'password' => 'password123',
            ],
        ];

        foreach ($defaultUsers as $userData) {
            User::updateOrCreate(
                ['username' => $userData['username']],
                [
                    'first_name' => $userData['first_name'],
                    'last_name' => $userData['last_name'],
                    'birthday' => $userData['birthday'],
                    'role' => $userData['role'],
                    'department_id' => $departments[$userData['department']]->id,
                    'use_custom_permissions' => false,
                    'password' => Hash::make($userData['password']),
                ]
            );
        }

        if ($this->seedOfficeMaterials()) {
            $this->call(OfficeMaterialsSeeder::class);
        }
    }

    protected function seedOfficeMaterials(): bool
    {
        return true;
    }
}
